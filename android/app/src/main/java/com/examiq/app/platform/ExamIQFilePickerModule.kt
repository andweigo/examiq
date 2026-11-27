package com.examiq.app.platform

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipInputStream

/**
 * Native Android offline document picker (ACTION_OPEN_DOCUMENT) with:
 * - Zero-dependency offline Excel (.xlsx) ZIP+XML parser & CSV parser for student rosters
 * - Backup file picker (.db / .enc.db / .json) for Registration & Backup Restore
 */
class ExamIQFilePickerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val REQ_PICK_SPREADSHEET = 49101
    private const val REQ_PICK_BACKUP = 49102
  }

  private var pendingPromise: Promise? = null
  private var pendingMode: Int = 0

  private val activityListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(
      activity: Activity,
      requestCode: Int,
      resultCode: Int,
      data: Intent?
    ) {
      if (requestCode != REQ_PICK_SPREADSHEET && requestCode != REQ_PICK_BACKUP) {
        return
      }
      val promise = pendingPromise
      pendingPromise = null
      if (promise == null) return

      if (resultCode != Activity.RESULT_OK || data?.data == null) {
        promise.resolve(null)
        return
      }

      val uri = data.data!!
      try {
        if (requestCode == REQ_PICK_SPREADSHEET) {
          handleSpreadsheetUri(uri, promise)
        } else {
          handleBackupUri(uri, promise)
        }
      } catch (e: Exception) {
        promise.reject("FILE_READ_ERROR", e.message ?: "Unable to read selected file.", e)
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  override fun getName(): String = "ExamIQFilePicker"

  @ReactMethod
  fun pickSpreadsheetFile(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Current Android activity is unavailable.")
      return
    }
    pendingPromise = promise
    pendingMode = REQ_PICK_SPREADSHEET

    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(
        Intent.EXTRA_MIME_TYPES,
        arrayOf(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
          "text/plain"
        )
      )
    }
    activity.startActivityForResult(intent, REQ_PICK_SPREADSHEET)
  }

  @ReactMethod
  fun pickBackupFile(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Current Android activity is unavailable.")
      return
    }
    pendingPromise = promise
    pendingMode = REQ_PICK_BACKUP

    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
    }
    activity.startActivityForResult(intent, REQ_PICK_BACKUP)
  }

  private fun queryDisplayName(uri: Uri): String {
    reactContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
      val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      if (nameIndex >= 0 && cursor.moveToFirst()) {
        return cursor.getString(nameIndex) ?: "selected_file"
      }
    }
    return uri.lastPathSegment ?: "selected_file"
  }

  private fun readAllBytes(uri: Uri): ByteArray {
    return reactContext.contentResolver.openInputStream(uri)?.use { input ->
      val out = ByteArrayOutputStream()
      val buf = ByteArray(8192)
      while (true) {
        val read = input.read(buf)
        if (read <= 0) break
        out.write(buf, 0, read)
      }
      out.toByteArray()
    } ?: ByteArray(0)
  }

  private fun handleBackupUri(uri: Uri, promise: Promise) {
    val fileName = queryDisplayName(uri)
    val bytes = readAllBytes(uri)
    if (bytes.isEmpty()) {
      promise.reject("EMPTY_FILE", "Selected backup file is empty.")
      return
    }

    val isJson = fileName.endsWith(".json", ignoreCase = true) ||
      (bytes.firstOrNull()?.toInt()?.toChar() == '{')

    if (isJson) {
      val map = Arguments.createMap().apply {
        putString("fileName", fileName)
        putString("format", "json")
        putString("payloadJson", String(bytes, Charsets.UTF_8))
      }
      promise.resolve(map)
      return
    }

    // Save binary .db / .enc.db to app cache so ExamIQSqliteModule can restore it cleanly
    val tempFile = java.io.File(reactContext.cacheDir, fileName.replace(Regex("[^A-Za-z0-9._-]"), "_"))
    tempFile.writeBytes(bytes)
    val map = Arguments.createMap().apply {
      putString("fileName", fileName)
      putString("format", "sqlite")
      putString("filePath", tempFile.absolutePath)
    }
    promise.resolve(map)
  }

  private fun handleSpreadsheetUri(uri: Uri, promise: Promise) {
    val fileName = queryDisplayName(uri)
    val bytes = readAllBytes(uri)
    if (bytes.isEmpty()) {
      promise.reject("EMPTY_FILE", "Selected spreadsheet file is empty.")
      return
    }

    // Detect ZIP magic header (PK\x03\x04) for .xlsx workbooks vs CSV/text
    val isXlsx = bytes.size >= 4 &&
      bytes[0] == 0x50.toByte() &&
      bytes[1] == 0x4B.toByte()

    val rawRows: List<List<String>> = if (isXlsx) {
      parseXlsxRows(bytes)
    } else {
      parseCsvRows(String(bytes, Charsets.UTF_8))
    }

    val normalized = normalizeRosterRows(rawRows)
    val rowsArray = Arguments.createArray()
    for (entry in normalized) {
      val item = Arguments.createMap().apply {
        putString("studentId", entry.studentId)
        putString("name", entry.name)
        putString("section", entry.section)
      }
      rowsArray.pushMap(item)
    }

    val result = Arguments.createMap().apply {
      putString("fileName", fileName)
      putString("fileType", if (isXlsx) "xlsx" else "csv")
      putArray("rows", rowsArray)
    }
    promise.resolve(result)
  }

  private data class ParsedStudentRow(
    val studentId: String,
    val name: String,
    val section: String
  )

  private fun parseCsvRows(text: String): List<List<String>> {
    val output = mutableListOf<List<String>>()
    for (rawLine in text.split(Regex("\\r?\\n"))) {
      val line = rawLine.trim()
      if (line.isEmpty()) continue
      val cells = mutableListOf<String>()
      val sb = StringBuilder()
      var inQuotes = false
      for (ch in line) {
        when {
          ch == '"' -> inQuotes = !inQuotes
          (ch == ',' || ch == ';' || ch == '\t') && !inQuotes -> {
            cells.add(sb.toString().trim())
            sb.setLength(0)
          }
          else -> sb.append(ch)
        }
      }
      cells.add(sb.toString().trim())
      output.add(cells)
    }
    return output
  }

  /**
   * Pure-Kotlin offline .xlsx workbook reader (reads xl/sharedStrings.xml + first xl/worksheets/sheet*.xml).
   */
  private fun parseXlsxRows(zipBytes: ByteArray): List<List<String>> {
    var sharedStringsXml: ByteArray? = null
    var sheetXml: ByteArray? = null

    ZipInputStream(ByteArrayInputStream(zipBytes)).use { zis ->
      while (true) {
        val entry = zis.nextEntry ?: break
        val name = entry.name.lowercase()
        if (name == "xl/sharedstrings.xml") {
          sharedStringsXml = zis.readBytes()
        } else if (sheetXml == null && name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml")) {
          sheetXml = zis.readBytes()
        }
        zis.closeEntry()
      }
    }

    val sharedStrings = sharedStringsXml?.let { parseSharedStrings(it) } ?: emptyList()
    val targetSheet = sheetXml ?: return emptyList()
    return parseWorksheetXml(targetSheet, sharedStrings)
  }

  private fun parseSharedStrings(xmlBytes: ByteArray): List<String> {
    val list = mutableListOf<String>()
    val parser = XmlPullParserFactory.newInstance().newPullParser()
    parser.setInput(ByteArrayInputStream(xmlBytes), "UTF-8")

    var insideSi = false
    var insideT = false
    val current = StringBuilder()
    var event = parser.eventType
    while (event != XmlPullParser.END_DOCUMENT) {
      when (event) {
        XmlPullParser.START_TAG -> {
          if (parser.name == "si") {
            insideSi = true
            current.setLength(0)
          } else if (insideSi && parser.name == "t") {
            insideT = true
          }
        }
        XmlPullParser.TEXT -> {
          if (insideSi && insideT) {
            current.append(parser.text ?: "")
          }
        }
        XmlPullParser.END_TAG -> {
          if (parser.name == "t") {
            insideT = false
          } else if (parser.name == "si") {
            list.add(current.toString().trim())
            insideSi = false
          }
        }
      }
      event = parser.next()
    }
    return list
  }

  private fun parseWorksheetXml(xmlBytes: ByteArray, sharedStrings: List<String>): List<List<String>> {
    val rows = mutableListOf<List<String>>()
    val parser = XmlPullParserFactory.newInstance().newPullParser()
    parser.setInput(ByteArrayInputStream(xmlBytes), "UTF-8")

    var currentRow: MutableList<String>? = null
    var cellType: String? = null
    var cellColIndex = 0
    var insideValue = false
    var insideInlineText = false
    val valueBuf = StringBuilder()

    var event = parser.eventType
    while (event != XmlPullParser.END_DOCUMENT) {
      when (event) {
        XmlPullParser.START_TAG -> {
          when (parser.name) {
            "row" -> currentRow = mutableListOf()
            "c" -> {
              cellType = parser.getAttributeValue(null, "t")
              val ref = parser.getAttributeValue(null, "r") ?: ""
              cellColIndex = columnRefToIndex(ref)
              valueBuf.setLength(0)
            }
            "v" -> insideValue = true
            "t" -> if (cellType == "inlineStr") insideInlineText = true
          }
        }
        XmlPullParser.TEXT -> {
          if (insideValue || insideInlineText) {
            valueBuf.append(parser.text ?: "")
          }
        }
        XmlPullParser.END_TAG -> {
          when (parser.name) {
            "v" -> insideValue = false
            "t" -> insideInlineText = false
            "c" -> {
              val row = currentRow
              if (row != null) {
                val raw = valueBuf.toString().trim()
                val resolved = if (cellType == "s") {
                  val idx = raw.toIntOrNull()
                  if (idx != null && idx in sharedStrings.indices) sharedStrings[idx] else raw
                } else {
                  raw
                }
                while (row.size < cellColIndex) {
                  row.add("")
                }
                if (cellColIndex == row.size) {
                  row.add(resolved)
                } else if (cellColIndex in row.indices) {
                  row[cellColIndex] = resolved
                }
              }
            }
            "row" -> {
              val row = currentRow
              if (row != null && row.any { it.isNotBlank() }) {
                rows.add(row)
              }
              currentRow = null
            }
          }
        }
      }
      event = parser.next()
    }
    return rows
  }

  private fun columnRefToIndex(ref: String): Int {
    var col = 0
    for (ch in ref) {
      if (ch in 'A'..'Z') {
        col = col * 26 + (ch - 'A' + 1)
      } else if (ch in 'a'..'z') {
        col = col * 26 + (ch - 'a' + 1)
      } else {
        break
      }
    }
    return (col - 1).coerceAtLeast(0)
  }

  /**
   * Intelligently maps Excel/CSV columns whether the sheet has headers like
   * [Student ID, Full Name, Section], [Last Name, First Name, Grade, Section], or [Name, Section].
   */
  private fun normalizeRosterRows(rawRows: List<List<String>>): List<ParsedStudentRow> {
    if (rawRows.isEmpty()) return emptyList()

    val firstLower = rawRows[0].map { it.lowercase() }
    val hasHeader = firstLower.any {
      it.contains("name") || it.contains("student") || it.contains("section") || it.contains("id") || it.contains("lrn")
    }

    var idCol = -1
    var nameCol = -1
    var firstNameCol = -1
    var lastNameCol = -1
    var gradeCol = -1
    var sectionCol = -1

    if (hasHeader) {
      firstLower.forEachIndexed { idx, header ->
        when {
          idCol == -1 && (header.contains("id") || header.contains("lrn")) -> idCol = idx
          firstNameCol == -1 && header.contains("first") -> firstNameCol = idx
          lastNameCol == -1 && header.contains("last") -> lastNameCol = idx
          nameCol == -1 && (header.contains("name") || header.contains("student")) -> nameCol = idx
          gradeCol == -1 && header.contains("grade") -> gradeCol = idx
          sectionCol == -1 && (header.contains("section") || header.contains("class")) -> sectionCol = idx
        }
      }
    }

    val dataRows = if (hasHeader) rawRows.drop(1) else rawRows
    val parsed = mutableListOf<ParsedStudentRow>()

    for (row in dataRows) {
      if (row.all { it.isBlank() }) continue

      val studentId = if (idCol in row.indices) row[idCol].trim() else ""
      val fullName = when {
        nameCol in row.indices && row[nameCol].isNotBlank() -> row[nameCol].trim()
        firstNameCol in row.indices || lastNameCol in row.indices -> {
          val first = if (firstNameCol in row.indices) row[firstNameCol].trim() else ""
          val last = if (lastNameCol in row.indices) row[lastNameCol].trim() else ""
          listOf(first, last).filter { it.isNotBlank() }.joinToString(" ")
        }
        row.size >= 3 && row[0].matches(Regex("[0-9\\-]+")) -> row[1].trim()
        else -> row[0].trim()
      }

      if (fullName.isBlank()) continue

      val grade = if (gradeCol in row.indices) row[gradeCol].trim() else ""
      val sectionRaw = when {
        sectionCol in row.indices -> row[sectionCol].trim()
        row.size >= 3 && row[0].matches(Regex("[0-9\\-]+")) -> row[2].trim()
        row.size >= 2 -> row[1].trim()
        else -> ""
      }
      val combinedSection = when {
        grade.isNotBlank() && sectionRaw.isNotBlank() && !sectionRaw.lowercase().contains("grade") ->
          "$grade $sectionRaw"
        sectionRaw.isNotBlank() -> sectionRaw
        else -> ""
      }

      parsed.add(
        ParsedStudentRow(
          studentId = if (studentId.isNotBlank()) studentId else if (row.size >= 3 && row[0].matches(Regex("[0-9\\-]+"))) row[0].trim() else "",
          name = fullName,
          section = combinedSection
        )
      )
    }

    return parsed
  }
}

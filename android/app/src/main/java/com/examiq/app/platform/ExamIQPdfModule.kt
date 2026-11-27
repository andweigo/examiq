package com.examiq.app.platform

import android.content.ContentValues
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Native Android OMR PDF generator supporting A4, Short (Letter 8.5x11"), and Long (Folio 8.5x13"):
 * - Centered QR Identity Card matching the mobile preview
 * - Exact item count mirrored from Exam Builder / Answer Key
 * - Answer Sheet Only OR Printable Exam Questionnaire + Answer Sheet
 * - Passing Rate Summary PDF, CSV Grade Sheet, and FileProvider native share/print
 */
class ExamIQPdfModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ExamIQPdf"

  private fun exportsDir(): File =
    File(reactContext.filesDir, "exports").apply { mkdirs() }

  private fun mirrorToDownloads(file: File, mimeType: String): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
    return try {
      val values = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, file.name)
        put(MediaStore.Downloads.MIME_TYPE, mimeType)
        put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/ExamIQ")
      }
      val uri = reactContext.contentResolver.insert(
        MediaStore.Downloads.EXTERNAL_CONTENT_URI,
        values
      ) ?: return false
      reactContext.contentResolver.openOutputStream(uri)?.use { out ->
        file.inputStream().use { input -> input.copyTo(out) }
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun drawOmrPage(
    canvas: Canvas,
    spec: PaperSpec,
    examSubject: String,
    examTerm: String,
    examDate: String,
    studentName: String,
    studentId: String,
    section: String,
    itemCount: Int,
    qrMatrix: JSONArray?,
    qrSize: Int
  ) {
    canvas.drawColor(Color.WHITE)

    val fillBlack = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#111111")
      style = Paint.Style.FILL
    }
    val strokeBlack = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#111111")
      style = Paint.Style.STROKE
      strokeWidth = 1.2f
    }
    val cardFill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#F7F7F4")
      style = Paint.Style.FILL
    }
    val mutedLine = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#D4D4CE")
      style = Paint.Style.STROKE
      strokeWidth = 0.8f
    }
    val boldText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#111111")
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    }
    val regularText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#4A4A45")
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
    }

    val m = OmrGeometry.MARKER_MARGIN_PT
    val s = OmrGeometry.MARKER_SIZE_PT
    val w = spec.widthPt
    val h = spec.heightPt

    // 1. 4 Solid Black Corner Registration Marks (exact OmrGeometry coordinates)
    canvas.drawRect(m, m, m + s, m + s, fillBlack)
    canvas.drawRect(w - m - s, m, w - m, m + s, fillBlack)
    canvas.drawRect(m, h - m - s, m + s, h - m, fillBlack)
    canvas.drawRect(w - m - s, h - m - s, w - m, h - m, fillBlack)

    // Top registration metadata
    boldText.textSize = 8f
    boldText.textAlign = Paint.Align.CENTER
    boldText.color = Color.parseColor("#6E6E68")
    canvas.drawText(
      "EXAMIQ · OMR TEMPLATE V2 · ${spec.label.uppercase()}",
      w / 2f,
      m + 15f,
      boldText
    )

    // 2. Side-by-Side Header: Left Exam & Student Details + Right Square QR Card (QR centered inside card)
    val cardSize = OmrGeometry.QR_CARD_SIZE_PT
    val cardRight = w - OmrGeometry.QR_CARD_RIGHT_INSET_PT
    val cardLeft = cardRight - cardSize
    val cardTop = OmrGeometry.HEADER_TOP_PT
    val cardBottom = cardTop + cardSize

    boldText.textAlign = Paint.Align.LEFT
    regularText.textAlign = Paint.Align.LEFT

    boldText.color = Color.parseColor("#111111")
    boldText.textSize = 16f
    canvas.drawText("$examSubject · $examTerm", 64f, cardTop + 26f, boldText)

    boldText.textSize = 12.5f
    canvas.drawText(studentName, 64f, cardTop + 48f, boldText)

    regularText.textSize = 9.5f
    val resolvedDate = if (Regex("\\b20\\d{2}\\b").containsMatchIn(examDate)) {
      examDate
    } else {
      "$examDate, ${java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)}"
    }
    canvas.drawText("Student ID: $studentId", 64f, cardTop + 68f, regularText)
    canvas.drawText("$section  ·  $resolvedDate", 64f, cardTop + 84f, regularText)
    canvas.drawText("$itemCount multiple-choice items  ·  ${spec.code}", 64f, cardTop + 98f, regularText)

    // Right-side clean white QR frame with QR matrix strictly centered horizontally & vertically inside
    val cardRect = RectF(cardLeft, cardTop, cardRight, cardBottom)
    val qrBg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      style = Paint.Style.FILL
    }
    canvas.drawRoundRect(cardRect, 10f, 10f, qrBg)
    canvas.drawRoundRect(cardRect, 10f, 10f, strokeBlack)

    if (qrMatrix != null && qrSize > 0) {
      val qrBox = 84f
      val qrLeft = cardLeft + (cardSize - qrBox) / 2f
      val qrTop = cardTop + (cardSize - qrBox) / 2f

      val cell = qrBox / qrSize.toFloat()
      for (idx in 0 until qrMatrix.length()) {
        if (qrMatrix.optInt(idx, 0) == 1) {
          val r = idx / qrSize
          val c = idx % qrSize
          canvas.drawRect(
            qrLeft + c * cell,
            qrTop + r * cell,
            qrLeft + (c + 1) * cell + 0.25f,
            qrTop + (r + 1) * cell + 0.25f,
            fillBlack
          )
        }
      }
    }

    // 3. Instructions Strip
    boldText.textAlign = Paint.Align.LEFT
    regularText.textAlign = Paint.Align.LEFT
    regularText.textSize = 9f
    canvas.drawText(
      "Shade bubbles completely with dark pen or pencil.",
      64f,
      196f,
      regularText
    )
    canvas.drawCircle(w - 114f, 193f, 5f, fillBlack)
    boldText.textSize = 9f
    canvas.drawText("Correct", w - 104f, 196f, boldText)
    canvas.drawLine(64f, 204f, w - 64f, 204f, mutedLine)

    // 4. Standardized 2-Column Bubble Grid (exact itemCount mirrored)
    // Bubble guide letters are printed in soft gray (#9A9A92) like Scantron/ZipGrade so
    // unshaded letters are readable to students yet ignored by grayscale OMR shading detection.
    val clampedCount = itemCount.coerceIn(1, 60)
    val choices = arrayOf("A", "B", "C", "D")
    val bubbleOutline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#2A2A27")
      style = Paint.Style.STROKE
      strokeWidth = 1.0f
    }
    val letterPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#9A9A92")
      textSize = 7.4f
      textAlign = Paint.Align.CENTER
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
    }

    val rowsPerCol = OmrGeometry.rowsPerColumn(clampedCount)
    for (itemNum in 1..clampedCount) {
      val zeroIdx = itemNum - 1
      val isRight = zeroIdx >= rowsPerCol
      val rowIdx = if (isRight) zeroIdx - rowsPerCol else zeroIdx

      // Crisp ZipGrade-style row timing tick for row-by-row vertical alignment on folded sheets
      val (tx, ty) = OmrGeometry.timingTickCenterPt(spec, rowIdx, isRight, clampedCount)
      canvas.drawRect(
        tx - OmrGeometry.TIMING_TICK_WIDTH_PT / 2f,
        ty - OmrGeometry.TIMING_TICK_HEIGHT_PT / 2f,
        tx + OmrGeometry.TIMING_TICK_WIDTH_PT / 2f,
        ty + OmrGeometry.TIMING_TICK_HEIGHT_PT / 2f,
        fillBlack
      )

      val (lx, ly) = OmrGeometry.itemRowBaselinePt(spec, itemNum, clampedCount)
      boldText.textSize = 9.5f
      canvas.drawText("$itemNum.", lx, ly + 3.2f, boldText)

      for (cIdx in 0..3) {
        val (cx, cy) = OmrGeometry.bubbleCenterPt(spec, itemNum, cIdx, clampedCount)
        canvas.drawCircle(cx, cy, OmrGeometry.BUBBLE_RADIUS_PT, bubbleOutline)
        canvas.drawText(choices[cIdx], cx, cy + 2.6f, letterPaint)
      }
    }

    // Footer safety line
    canvas.drawLine(64f, h - 72f, w - 64f, h - 72f, mutedLine)
    regularText.textSize = 8.2f
    regularText.textAlign = Paint.Align.CENTER
    canvas.drawText(
      "Do not fold, crease, or cover the 4 corner registration marks or QR card.",
      w / 2f,
      h - 48f,
      regularText
    )
  }

  private fun drawQuestionnairePages(
    doc: PdfDocument,
    spec: PaperSpec,
    startPageNumber: Int,
    examSubject: String,
    examTerm: String,
    section: String,
    examDate: String,
    questions: JSONArray
  ): Int {
    if (questions.length() == 0) return startPageNumber

    var pageNum = startPageNumber
    val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#111111")
      textSize = 17f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    }
    val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#6E6E68")
      textSize = 10f
    }
    val qPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#111111")
      textSize = 11f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    }
    val choicePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#333330")
      textSize = 10.5f
    }
    val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#E4E4DE")
      strokeWidth = 0.8f
    }

    var page = doc.startPage(
      PdfDocument.PageInfo.Builder(spec.widthPt.toInt(), spec.heightPt.toInt(), pageNum).create()
    )
    var canvas = page.canvas
    canvas.drawColor(Color.WHITE)

    val resolvedQDate = if (Regex("\\b20\\d{2}\\b").containsMatchIn(examDate)) {
      examDate
    } else {
      "$examDate, ${java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)}"
    }
    canvas.drawText("$examSubject · $examTerm — Question Sheet", 48f, 56f, titlePaint)
    canvas.drawText("$section   ·   $resolvedQDate   ·   ${spec.label}", 48f, 74f, subPaint)
    canvas.drawText("Name: ____________________________________    Score: ______ / ${questions.length()}", 48f, 94f, choicePaint)
    canvas.drawLine(48f, 104f, spec.widthPt - 48f, 104f, linePaint)

    var y = 128f
    val letters = arrayOf("A", "B", "C", "D")

    for (i in 0 until questions.length()) {
      if (y > spec.heightPt - 96f) {
        doc.finishPage(page)
        pageNum++
        page = doc.startPage(
          PdfDocument.PageInfo.Builder(spec.widthPt.toInt(), spec.heightPt.toInt(), pageNum).create()
        )
        canvas = page.canvas
        canvas.drawColor(Color.WHITE)
        y = 58f
      }

      val q = questions.getJSONObject(i)
      val kind = q.optString("kind", "mcq")
      if (kind == "essay") {
        if (y > spec.heightPt - 135f) {
          doc.finishPage(page)
          pageNum++
          page = doc.startPage(
            PdfDocument.PageInfo.Builder(spec.widthPt.toInt(), spec.heightPt.toInt(), pageNum).create()
          )
          canvas = page.canvas
          canvas.drawColor(Color.WHITE)
          y = 58f
        }
        val pts = q.optInt("maxPoints", 10)
        canvas.drawText(
          "${q.optInt("num", i + 1)}. [Essay · $pts pts · Manual] ${q.optString("text")}",
          48f,
          y,
          qPaint
        )
        y += 16f
        val rubric = q.optString("rubric", "")
        if (rubric.isNotBlank()) {
          canvas.drawText("Criteria: $rubric", 60f, y, subPaint)
          y += 14f
        }
        for (lineIdx in 0..3) {
          y += 18f
          canvas.drawLine(58f, y, spec.widthPt - 48f, y, linePaint)
        }
        y += 18f
        continue
      }

      canvas.drawText("${q.optInt("num", i + 1)}. ${q.optString("text")}", 48f, y, qPaint)
      y += 18f

      val choices = q.optJSONArray("choices")
      if (choices != null) {
        val leftX = 62f
        val rightX = spec.widthPt / 2f + 10f
        if (choices.length() >= 2) {
          canvas.drawText("${letters[0]}. ${choices.optString(0)}", leftX, y, choicePaint)
          canvas.drawText("${letters[1]}. ${choices.optString(1)}", rightX, y, choicePaint)
          y += 16f
        }
        if (choices.length() >= 4) {
          canvas.drawText("${letters[2]}. ${choices.optString(2)}", leftX, y, choicePaint)
          canvas.drawText("${letters[3]}. ${choices.optString(3)}", rightX, y, choicePaint)
          y += 20f
        }
      } else {
        y += 12f
      }
    }

    doc.finishPage(page)
    return pageNum + 1
  }

  @ReactMethod
  fun generateAnswerSheetPdf(sheetJson: String, promise: Promise) {
    try {
      val obj = JSONObject(sheetJson)
      val spec = PaperSpec.fromCode(obj.optString("paperSize", "A4"))
      val exportMode = obj.optString(
        "exportMode",
        if (obj.optBoolean("includeQuestionnaire", false)) "full-exam" else "sheet-only"
      )
      val questions = obj.optJSONArray("questions")

      val doc = PdfDocument()
      var nextPageNum = 1

      val drawQuestions = exportMode == "questions-only" || exportMode == "full-exam"
      val drawOmr = exportMode == "sheet-only" || exportMode == "full-exam"

      if (drawQuestions && questions != null && questions.length() > 0) {
        nextPageNum = drawQuestionnairePages(
          doc = doc,
          spec = spec,
          startPageNumber = nextPageNum,
          examSubject = obj.optString("subject", "Exam"),
          examTerm = obj.optString("term", "Quiz"),
          section = obj.optString("section", "Grade 10"),
          examDate = obj.optString("date", "Nov 27"),
          questions = questions
        )
      }

      if (drawOmr || nextPageNum == 1) {
        val pageInfo = PdfDocument.PageInfo.Builder(
          spec.widthPt.toInt(),
          spec.heightPt.toInt(),
          nextPageNum
        ).create()
        val page = doc.startPage(pageInfo)
        drawOmrPage(
          canvas = page.canvas,
          spec = spec,
          examSubject = obj.optString("subject", "Exam"),
          examTerm = obj.optString("term", "Quiz"),
          examDate = obj.optString("date", "Nov 27"),
          studentName = obj.optString("studentName", "Student"),
          studentId = obj.optString("studentId", "2026-0001"),
          section = obj.optString("section", "Grade 10"),
          itemCount = obj.optInt("itemCount", 50),
          qrMatrix = obj.optJSONArray("qrMatrix"),
          qrSize = obj.optInt("qrSize", 0)
        )
        doc.finishPage(page)
      }

      val suffix = when (exportMode) {
        "questions-only" -> "Questions"
        "full-exam" -> "FullExam"
        else -> "OMR"
      }
      val safeName = if (exportMode == "questions-only") {
        "${obj.optString("subject")}_${obj.optString("term")}_${spec.code}_$suffix.pdf"
      } else {
        "${obj.optString("subject")}_${obj.optString("studentId")}_${spec.code}_$suffix.pdf"
      }.replace(Regex("[^A-Za-z0-9._-]"), "_")
      val outFile = File(exportsDir(), safeName)
      FileOutputStream(outFile).use { doc.writeTo(it) }
      doc.close()

      val inDownloads = mirrorToDownloads(outFile, "application/pdf")
      val result = Arguments.createMap().apply {
        putString("filePath", outFile.absolutePath)
        putString("fileName", safeName)
        putDouble("sizeBytes", outFile.length().toDouble())
        putBoolean("savedToDownloads", inDownloads)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("PDF_SINGLE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun generateBatchAnswerSheetsPdf(batchJson: String, promise: Promise) {
    try {
      val root = JSONObject(batchJson)
      val spec = PaperSpec.fromCode(root.optString("paperSize", "A4"))
      val sheets = root.getJSONArray("sheets")
      val doc = PdfDocument()

      for (i in 0 until sheets.length()) {
        val obj = sheets.getJSONObject(i)
        val pageInfo = PdfDocument.PageInfo.Builder(
          spec.widthPt.toInt(),
          spec.heightPt.toInt(),
          i + 1
        ).create()
        val page = doc.startPage(pageInfo)
        drawOmrPage(
          canvas = page.canvas,
          spec = spec,
          examSubject = obj.optString("subject", "Exam"),
          examTerm = obj.optString("term", "Quiz"),
          examDate = obj.optString("date", "Nov 27"),
          studentName = obj.optString("studentName", "Student"),
          studentId = obj.optString("studentId", "2026-0001"),
          section = obj.optString("section", "Grade 10"),
          itemCount = obj.optInt("itemCount", 50),
          qrMatrix = obj.optJSONArray("qrMatrix"),
          qrSize = obj.optInt("qrSize", 0)
        )
        doc.finishPage(page)
      }

      val safeName = "${root.optString("subject")}_${root.optString("term")}_${spec.code}_${sheets.length()}.pdf"
        .replace(Regex("[^A-Za-z0-9._-]"), "_")
      val outFile = File(exportsDir(), safeName)
      FileOutputStream(outFile).use { doc.writeTo(it) }
      doc.close()

      val inDownloads = mirrorToDownloads(outFile, "application/pdf")
      val result = Arguments.createMap().apply {
        putString("filePath", outFile.absolutePath)
        putString("fileName", safeName)
        putInt("pageCount", sheets.length())
        putDouble("sizeBytes", outFile.length().toDouble())
        putBoolean("savedToDownloads", inDownloads)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("PDF_BATCH_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun generatePassingRatePdf(reportJson: String, promise: Promise) {
    val doc = PdfDocument()
    try {
      val root = JSONObject(reportJson)
      val students = root.getJSONArray("students")
      var pageNum = 1
      var page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNum).create())
      var canvas = page.canvas
      canvas.drawColor(Color.WHITE)

      val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#111111")
        textSize = 20f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      }
      val headerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#111111")
        textSize = 12f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      }
      val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#6E6E68")
        textSize = 11f
      }
      val kpiBg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#F5F5F2")
        style = Paint.Style.FILL
      }
      val rowText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#111111")
        textSize = 11f
      }
      val failText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#D94E28")
        textSize = 11f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      }
      val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#E4E4DE")
        strokeWidth = 1f
      }

      fun drawTableHeader(c: Canvas, startY: Float): Float {
        c.drawText("Student ID", 44f, startY, headerPaint)
        c.drawText("Name", 136f, startY, headerPaint)
        c.drawText("Section", 308f, startY, headerPaint)
        c.drawText("Score", 442f, startY, headerPaint)
        c.drawText("Status", 498f, startY, headerPaint)
        val lineY = startY + 10f
        c.drawLine(44f, lineY, 551f, lineY, linePaint)
        return lineY + 20f
      }

      canvas.drawText("ExamIQ · Passing Rate Summary", 44f, 64f, titlePaint)
      canvas.drawText(
        "${root.optString("examTitle")}  ·  ${root.optString("schoolName")}  ·  Teacher: ${root.optString("teacherName")}",
        44f,
        84f,
        subPaint
      )

      canvas.drawRoundRect(RectF(44f, 106f, 290f, 172f), 14f, 14f, kpiBg)
      canvas.drawRoundRect(RectF(306f, 106f, 551f, 172f), 14f, 14f, kpiBg)

      canvas.drawText("Passing Rate (>= 75%)", 60f, 128f, subPaint)
      canvas.drawText("${root.optInt("passingRate")}% (${root.optInt("passedCount")}/${root.optInt("totalStudents")})", 60f, 156f, titlePaint)

      canvas.drawText("Class Mean Score", 322f, 128f, subPaint)
      canvas.drawText("${root.optDouble("meanScore")}", 322f, 156f, titlePaint)

      var y = drawTableHeader(canvas, 212f)

      for (i in 0 until students.length()) {
        if (y > 790f) {
          doc.finishPage(page)
          pageNum += 1
          page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNum).create())
          canvas = page.canvas
          canvas.drawColor(Color.WHITE)
          canvas.drawText("ExamIQ · Passing Rate Summary (Page $pageNum)", 44f, 52f, subPaint)
          y = drawTableHeader(canvas, 82f)
        }
        val s = students.getJSONObject(i)
        val score = s.optInt("score") + s.optInt("manualScore", 0)
        val total = (s.optInt("total", 50) + s.optInt("manualMax", 0)).coerceAtLeast(1)
        val pct = Math.round((score.toDouble() / total.toDouble()) * 1000.0) / 10.0
        val passed = pct >= 75.0

        canvas.drawText(s.optString("id"), 44f, y, rowText)
        canvas.drawText(s.optString("name"), 136f, y, rowText)
        canvas.drawText(s.optString("section"), 308f, y, subPaint)
        canvas.drawText("$score / $total", 442f, y, if (passed) rowText else failText)
        canvas.drawText(if (passed) "Passed" else "Below 75%", 498f, y, if (passed) rowText else failText)
        y += 10f
        canvas.drawLine(44f, y, 551f, y, linePaint)
        y += 18f
      }

      doc.finishPage(page)
      val safeName = root.optString("fileName", "ExamIQ_Passing_Summary.pdf")
        .replace(Regex("[^A-Za-z0-9._-]"), "_")
      val outFile = File(exportsDir(), safeName)
      FileOutputStream(outFile).use { doc.writeTo(it) }

      val inDownloads = mirrorToDownloads(outFile, "application/pdf")
      val result = Arguments.createMap().apply {
        putString("filePath", outFile.absolutePath)
        putString("fileName", safeName)
        putDouble("sizeBytes", outFile.length().toDouble())
        putBoolean("savedToDownloads", inDownloads)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("PDF_REPORT_ERROR", e.message, e)
    } finally {
      doc.close()
    }
  }

  @ReactMethod
  fun exportGradeSheetCsv(fileName: String, csvContent: String, promise: Promise) {
    try {
      val safeName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_")
      val outFile = File(exportsDir(), safeName)
      outFile.writeText(csvContent, Charsets.UTF_8)
      val inDownloads = mirrorToDownloads(outFile, "text/csv")
      val result = Arguments.createMap().apply {
        putString("filePath", outFile.absolutePath)
        putString("fileName", safeName)
        putDouble("sizeBytes", outFile.length().toDouble())
        putBoolean("savedToDownloads", inDownloads)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("CSV_EXPORT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun shareFile(filePath: String, mimeType: String, title: String, promise: Promise) {
    try {
      val file = File(filePath)
      if (!file.exists()) {
        promise.reject("FILE_NOT_FOUND", "File does not exist: $filePath")
        return
      }
      val authority = "${reactContext.packageName}.fileprovider"
      val uri = FileProvider.getUriForFile(reactContext, authority, file)
      val shareIntent = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, title)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(shareIntent, title).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(chooser)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SHARE_FILE_ERROR", e.message, e)
    }
  }
}

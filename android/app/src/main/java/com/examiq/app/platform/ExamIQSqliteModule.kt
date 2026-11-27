package com.examiq.app.platform

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.KeyStore
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private const val DB_NAME = "examiq_offline.db"
private const val DB_VERSION = 1
private const val KEYSTORE_ALIAS = "com.examiq.app.backup_aes_key"

private class ExamIQDbHelper(context: Context) :
  SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS app_state_snapshot (
        key TEXT PRIMARY KEY NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      """.trimIndent()
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS teacher_profile (
        id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        role_title TEXT NOT NULL,
        school_name TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      """.trimIndent()
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY NOT NULL,
        grade_level TEXT NOT NULL,
        section_name TEXT NOT NULL,
        advisor_name TEXT NOT NULL,
        student_count INTEGER NOT NULL DEFAULT 0
      );
      """.trimIndent()
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        accent TEXT NOT NULL,
        passing_rate INTEGER NOT NULL DEFAULT 0
      );
      """.trimIndent()
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        section TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 50,
        status TEXT NOT NULL
      );
      """.trimIndent()
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS exams (
        id TEXT PRIMARY KEY NOT NULL,
        subject TEXT NOT NULL,
        term TEXT NOT NULL,
        section TEXT NOT NULL,
        exam_date TEXT NOT NULL,
        scanned INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 40,
        items INTEGER NOT NULL DEFAULT 50,
        color TEXT NOT NULL
      );
      """.trimIndent()
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS scan_history (
        id TEXT PRIMARY KEY NOT NULL,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        meta TEXT NOT NULL,
        status TEXT NOT NULL
      );
      """.trimIndent()
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    // Future schema migrations go here safely without dropping teacher data.
  }
}

/**
 * Native Android offline SQLite persistence + Android Keystore AES-256-GCM
 * encrypted backup/restore module.
 */
class ExamIQSqliteModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val TAG = "ExamIQSqlite"
  }

  private val dbLock = Any()
  private val dbHelper: ExamIQDbHelper by lazy { ExamIQDbHelper(reactContext) }

  override fun getName(): String = "ExamIQSqlite"

  private fun clearSidecarJournalFiles(dbFile: File) {
    File("${dbFile.absolutePath}-journal").delete()
    File("${dbFile.absolutePath}-wal").delete()
    File("${dbFile.absolutePath}-shm").delete()
  }

  private fun querySqliteVersion(db: SQLiteDatabase): String {
    db.rawQuery("SELECT sqlite_version()", null).use { cursor ->
      if (cursor.moveToFirst()) {
        return cursor.getString(0) ?: "3.x"
      }
    }
    return "3.x"
  }

  private fun getOrCreateKeystoreSecretKey(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val existing = keyStore.getKey(KEYSTORE_ALIAS, null) as? SecretKey
    if (existing != null) {
      return existing
    }
    val keyGen = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES,
      "AndroidKeyStore"
    )
    val spec = KeyGenParameterSpec.Builder(
      KEYSTORE_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .build()
    keyGen.init(spec)
    return keyGen.generateKey()
  }

  private fun encryptBytes(plain: ByteArray): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKeystoreSecretKey())
    val iv = cipher.iv
    val encrypted = cipher.doFinal(plain)
    val output = ByteArray(1 + iv.size + encrypted.size)
    output[0] = iv.size.toByte()
    System.arraycopy(iv, 0, output, 1, iv.size)
    System.arraycopy(encrypted, 0, output, 1 + iv.size, encrypted.size)
    return output
  }

  private fun decryptBytes(blob: ByteArray): ByteArray {
    val ivLength = blob[0].toInt() and 0xFF
    val iv = blob.copyOfRange(1, 1 + ivLength)
    val encrypted = blob.copyOfRange(1 + ivLength, blob.size)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(
      Cipher.DECRYPT_MODE,
      getOrCreateKeystoreSecretKey(),
      GCMParameterSpec(128, iv)
    )
    return cipher.doFinal(encrypted)
  }

  @ReactMethod
  fun initDatabase(promise: Promise) {
    synchronized(dbLock) {
      try {
        val db = dbHelper.writableDatabase
        val version = querySqliteVersion(db)
        val dbFile = reactContext.getDatabasePath(DB_NAME)
        val result = Arguments.createMap().apply {
          putString("path", dbFile.absolutePath)
          putDouble("sizeBytes", dbFile.length().toDouble())
          putString("sqliteVersion", version)
          putString("deviceLabel", "${Build.MODEL} · SQLite v$version")
        }
        Log.d(TAG, "initDatabase ok (${dbFile.length()} bytes, SQLite v$version)")
        promise.resolve(result)
      } catch (e: Exception) {
        Log.e(TAG, "initDatabase failed: ${e.message}", e)
        promise.reject("SQLITE_INIT_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun loadSnapshot(promise: Promise) {
    synchronized(dbLock) {
      try {
        val db = dbHelper.readableDatabase
        db.rawQuery(
          "SELECT payload_json FROM app_state_snapshot WHERE key = ? LIMIT 1",
          arrayOf("main")
        ).use { cursor ->
          if (cursor.moveToFirst()) {
            val payload = cursor.getString(0)
            Log.d(TAG, "loadSnapshot loaded (${payload?.length ?: 0} chars)")
            promise.resolve(payload)
          } else {
            Log.d(TAG, "loadSnapshot empty (first launch)")
            promise.resolve(null)
          }
        }
      } catch (e: Exception) {
        Log.e(TAG, "loadSnapshot failed: ${e.message}", e)
        promise.reject("SQLITE_LOAD_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun saveSnapshot(payloadJson: String, promise: Promise) {
    synchronized(dbLock) {
      val db = dbHelper.writableDatabase
      db.beginTransaction()
      try {
        val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        val snapshotValues = ContentValues().apply {
          put("key", "main")
          put("payload_json", payloadJson)
          put("updated_at", now)
        }
        db.insertWithOnConflict(
          "app_state_snapshot",
          null,
          snapshotValues,
          SQLiteDatabase.CONFLICT_REPLACE
        )

        // Mirror normalized relational tables so the exported .db file is standard queryable SQLite!
        val root = JSONObject(payloadJson)
        var savedTeacherName = ""
        root.optJSONObject("profile")?.optJSONObject("teacher")?.let { t ->
          savedTeacherName = t.optString("name")
          val cv = ContentValues().apply {
            put("id", "teacher-primary")
            put("full_name", savedTeacherName)
            put("role_title", t.optString("role"))
            put("school_name", t.optString("school"))
            put("updated_at", now)
          }
          db.insertWithOnConflict("teacher_profile", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
        }

        root.optJSONObject("roster")?.let { roster ->
          roster.optJSONArray("classes")?.let { arr ->
            db.delete("classes", null, null)
            for (i in 0 until arr.length()) {
              val c = arr.getJSONObject(i)
              val cv = ContentValues().apply {
                put("id", c.optString("id"))
                put("grade_level", c.optString("grade"))
                put("section_name", c.optString("section"))
                put("advisor_name", c.optString("advisor"))
                put("student_count", c.optInt("students"))
              }
              db.insert("classes", null, cv)
            }
          }
          roster.optJSONArray("subjects")?.let { arr ->
            db.delete("subjects", null, null)
            for (i in 0 until arr.length()) {
              val s = arr.getJSONObject(i)
              val cv = ContentValues().apply {
                put("id", s.optString("id"))
                put("code", s.optString("code"))
                put("name", s.optString("name"))
                put("accent", s.optString("color"))
                put("passing_rate", s.optInt("passingRate"))
              }
              db.insert("subjects", null, cv)
            }
          }
          roster.optJSONArray("students")?.let { arr ->
            db.delete("students", null, null)
            for (i in 0 until arr.length()) {
              val st = arr.getJSONObject(i)
              val cv = ContentValues().apply {
                put("id", st.optString("id"))
                put("full_name", st.optString("name"))
                put("section", st.optString("section"))
                put("score", st.optInt("score"))
                put("total", st.optInt("total"))
                put("status", st.optString("status"))
              }
              db.insert("students", null, cv)
            }
          }
        }

        root.optJSONObject("exams")?.optJSONArray("exams")?.let { arr ->
          db.delete("exams", null, null)
          for (i in 0 until arr.length()) {
            val ex = arr.getJSONObject(i)
            val cv = ContentValues().apply {
              put("id", ex.optString("id"))
              put("subject", ex.optString("subject"))
              put("term", ex.optString("term"))
              put("section", ex.optString("section"))
              put("exam_date", ex.optString("date"))
              put("scanned", ex.optInt("scanned"))
              put("total", ex.optInt("total"))
              put("items", ex.optInt("items"))
              put("color", ex.optString("color"))
            }
            db.insert("exams", null, cv)
          }
        }

        root.optJSONObject("scanning")?.optJSONArray("scanHistory")?.let { arr ->
          db.delete("scan_history", null, null)
          for (i in 0 until arr.length()) {
            val sc = arr.getJSONObject(i)
            val cv = ContentValues().apply {
              put("id", sc.optString("id"))
              put("student_id", sc.optString("studentId"))
              put("student_name", sc.optString("name"))
              put("meta", sc.optString("meta"))
              put("status", sc.optString("status"))
            }
            db.insert("scan_history", null, cv)
          }
        }

        db.setTransactionSuccessful()
        val dbFile = reactContext.getDatabasePath(DB_NAME)
        Log.d(TAG, "saveSnapshot committed (${payloadJson.length} chars, teacher='$savedTeacherName')")
        promise.resolve(dbFile.length().toDouble())
      } catch (e: Exception) {
        Log.e(TAG, "saveSnapshot failed: ${e.message}", e)
        promise.reject("SQLITE_SAVE_ERROR", e.message, e)
      } finally {
        db.endTransaction()
      }
    }
  }

  @ReactMethod
  fun getDatabaseStats(promise: Promise) {
    synchronized(dbLock) {
      try {
        val db = dbHelper.readableDatabase
        val version = querySqliteVersion(db)
        val dbFile = reactContext.getDatabasePath(DB_NAME)
        val map = Arguments.createMap().apply {
          putString("path", dbFile.absolutePath)
          putDouble("sizeBytes", dbFile.length().toDouble())
          putString("sqliteVersion", version)
          putString("deviceLabel", "${Build.MODEL} · SQLite v$version")
        }
        promise.resolve(map)
      } catch (e: Exception) {
        promise.reject("SQLITE_STATS_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun exportDatabaseBackup(encrypt: Boolean, promise: Promise) {
    try {
      // Flush WAL/journal cleanly
      dbHelper.writableDatabase.rawQuery("PRAGMA wal_checkpoint(FULL)", null).close()
      val dbFile = reactContext.getDatabasePath(DB_NAME)
      val rawBytes = dbFile.readBytes()
      val finalBytes = if (encrypt) encryptBytes(rawBytes) else rawBytes

      val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
      val ext = if (encrypt) ".examiq.enc.db" else ".db"
      val fileName = "examiq_backup_$stamp$ext"

      // Save internal copy for 1-tap restore & FileProvider sharing
      val backupDir = File(reactContext.filesDir, "backups").apply { mkdirs() }
      val localFile = File(backupDir, fileName)
      FileOutputStream(localFile).use { it.write(finalBytes) }

      // Also save a visible copy to Downloads/ExamIQ via MediaStore on Android 10+
      var savedToDownloads = false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
          put(MediaStore.Downloads.DISPLAY_NAME, fileName)
          put(MediaStore.Downloads.MIME_TYPE, "application/octet-stream")
          put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/ExamIQ")
        }
        val uri = reactContext.contentResolver.insert(
          MediaStore.Downloads.EXTERNAL_CONTENT_URI,
          values
        )
        if (uri != null) {
          reactContext.contentResolver.openOutputStream(uri)?.use { out ->
            out.write(finalBytes)
            savedToDownloads = true
          }
        }
      }

      val result = Arguments.createMap().apply {
        putString("filePath", localFile.absolutePath)
        putString("fileName", fileName)
        putDouble("sizeBytes", finalBytes.size.toDouble())
        putBoolean("encrypted", encrypt)
        putBoolean("savedToDownloads", savedToDownloads)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("BACKUP_EXPORT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun restoreLatestLocalDbBackup(promise: Promise) {
    synchronized(dbLock) {
      try {
        val backupDir = File(reactContext.filesDir, "backups")
        val latest = backupDir.listFiles()
          ?.filter { it.isFile && it.name.startsWith("examiq_backup_") }
          ?.maxByOrNull { it.lastModified() }
          ?: run {
            promise.reject("BACKUP_NOT_FOUND", "No local backup files found on device.")
            return
          }

        val rawBytes = latest.readBytes()
        val restoredDbBytes = if (latest.name.endsWith(".enc.db")) {
          decryptBytes(rawBytes)
        } else {
          rawBytes
        }

        dbHelper.close()
        val dbFile = reactContext.getDatabasePath(DB_NAME)
        clearSidecarJournalFiles(dbFile)
        FileOutputStream(dbFile).use { it.write(restoredDbBytes) }

        val reopened = dbHelper.readableDatabase
        reopened.rawQuery(
          "SELECT payload_json FROM app_state_snapshot WHERE key = ? LIMIT 1",
          arrayOf("main")
        ).use { cursor ->
          val json = if (cursor.moveToFirst()) cursor.getString(0) else null
          val map = Arguments.createMap().apply {
            putString("fileName", latest.name)
            putString("payloadJson", json)
          }
          promise.resolve(map)
        }
      } catch (e: Exception) {
        promise.reject("BACKUP_RESTORE_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun restoreBackupFromPath(filePath: String, promise: Promise) {
    synchronized(dbLock) {
      try {
        val sourceFile = File(filePath)
        if (!sourceFile.exists()) {
          promise.reject("BACKUP_NOT_FOUND", "Selected backup file was not found.")
          return
        }
        val rawBytes = sourceFile.readBytes()
        val restoredDbBytes = if (sourceFile.name.endsWith(".enc.db", ignoreCase = true)) {
          decryptBytes(rawBytes)
        } else {
          rawBytes
        }

        dbHelper.close()
        val dbFile = reactContext.getDatabasePath(DB_NAME)
        clearSidecarJournalFiles(dbFile)
        FileOutputStream(dbFile).use { it.write(restoredDbBytes) }

        val reopened = dbHelper.readableDatabase
        reopened.rawQuery(
          "SELECT payload_json FROM app_state_snapshot WHERE key = ? LIMIT 1",
          arrayOf("main")
        ).use { cursor ->
          val json = if (cursor.moveToFirst()) cursor.getString(0) else null
          val map = Arguments.createMap().apply {
            putString("fileName", sourceFile.name)
            putString("payloadJson", json)
          }
          promise.resolve(map)
        }
      } catch (e: Exception) {
        promise.reject("BACKUP_RESTORE_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun wipeAllData(promise: Promise) {
    synchronized(dbLock) {
      try {
        dbHelper.close()
        reactContext.deleteDatabase(DB_NAME)
        File(reactContext.filesDir, "scans").deleteRecursively()
        File(reactContext.filesDir, "exports").deleteRecursively()
        // Re-create empty clean schema
        val db = dbHelper.writableDatabase
        val version = querySqliteVersion(db)
        val dbFile = reactContext.getDatabasePath(DB_NAME)
        Log.d(TAG, "wipeAllData complete (${dbFile.length()} bytes)")
        val result = Arguments.createMap().apply {
          putBoolean("wiped", true)
          putDouble("sizeBytes", dbFile.length().toDouble())
          putString("deviceLabel", "${Build.MODEL} · SQLite v$version")
        }
        promise.resolve(result)
      } catch (e: Exception) {
        Log.e(TAG, "wipeAllData failed: ${e.message}", e)
        promise.reject("SQLITE_WIPE_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun hashPinSecurely(pin: String, promise: Promise) {
    try {
      val digest = MessageDigest.getInstance("SHA-256")
      val hashed = digest.digest("EXAMIQ_KEYSTORE_PIN|$pin".toByteArray(Charsets.UTF_8))
      promise.resolve(Base64.encodeToString(hashed, Base64.NO_WRAP))
    } catch (e: Exception) {
      promise.reject("PIN_HASH_ERROR", e.message, e)
    }
  }
}


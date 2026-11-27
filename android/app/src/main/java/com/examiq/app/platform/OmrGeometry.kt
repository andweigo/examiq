package com.examiq.app.platform

import kotlin.math.ceil

enum class PaperSpec(
  val code: String,
  val label: String,
  val widthPt: Float,
  val heightPt: Float,
  val warpWidthPx: Int,
  val warpHeightPx: Int
) {
  A4("A4", "A4 (210×297mm)", 595f, 842f, 1190, 1684),
  SHORT("SHORT", "Short / Letter (8.5×11\")", 612f, 792f, 1224, 1584),
  LONG("LONG", "Long / Folio (8.5×13\")", 612f, 936f, 1224, 1872);

  companion object {
    fun fromCode(code: String?): PaperSpec {
      return when (code?.uppercase()) {
        "SHORT", "LETTER" -> SHORT
        "LONG", "FOLIO", "LEGAL" -> LONG
        else -> A4
      }
    }
  }
}

/**
 * Single source of truth for canonical OMR_REGISTRATION_TEMPLATE_V2 coordinates
 * across A4, Short (Letter 8.5x11"), and Long (Folio 8.5x13") bond paper sizes.
 * Shared identically by ExamIQPdfModule (PDF rendering) and ExamIQOmrModule (perspective warp + bubble reading).
 */
object OmrGeometry {
  const val MARKER_SIZE_PT = 24f
  const val MARKER_MARGIN_PT = 34f
  const val BUBBLE_RADIUS_PT = 7.2f

  // Header row (y=68..172) has left-aligned exam metadata and a right-side square QR card (with QR centered inside)
  const val HEADER_TOP_PT = 68f
  const val QR_CARD_SIZE_PT = 104f
  const val QR_CARD_RIGHT_INSET_PT = 64f
  const val GRID_START_Y_PT = 224f
  const val TIMING_TICK_WIDTH_PT = 7.5f
  const val TIMING_TICK_HEIGHT_PT = 3.4f

  fun tlCenterPt(): Pair<Float, Float> =
    Pair(MARKER_MARGIN_PT + MARKER_SIZE_PT / 2f, MARKER_MARGIN_PT + MARKER_SIZE_PT / 2f)

  fun trCenterPt(spec: PaperSpec): Pair<Float, Float> =
    Pair(spec.widthPt - MARKER_MARGIN_PT - MARKER_SIZE_PT / 2f, MARKER_MARGIN_PT + MARKER_SIZE_PT / 2f)

  fun blCenterPt(spec: PaperSpec): Pair<Float, Float> =
    Pair(MARKER_MARGIN_PT + MARKER_SIZE_PT / 2f, spec.heightPt - MARKER_MARGIN_PT - MARKER_SIZE_PT / 2f)

  fun brCenterPt(spec: PaperSpec): Pair<Float, Float> =
    Pair(spec.widthPt - MARKER_MARGIN_PT - MARKER_SIZE_PT / 2f, spec.heightPt - MARKER_MARGIN_PT - MARKER_SIZE_PT / 2f)

  fun rowsPerColumn(itemCount: Int): Int {
    val clamped = itemCount.coerceIn(1, 60)
    return ceil(clamped / 2.0).toInt().coerceAtLeast(1)
  }

  fun rowStepPt(spec: PaperSpec, itemCount: Int): Float {
    val rows = rowsPerColumn(itemCount)
    val availableHeight = (spec.heightPt - MARKER_MARGIN_PT - MARKER_SIZE_PT - 34f) - GRID_START_Y_PT
    val naturalStep = availableHeight / rows.coerceAtLeast(1).toFloat()
    return naturalStep.coerceIn(16.5f, 23f)
  }

  private fun leftColsX(spec: PaperSpec): FloatArray {
    val leftBase = 114f + (spec.widthPt - 595f) * 0.25f
    return floatArrayOf(leftBase, leftBase + 34f, leftBase + 68f, leftBase + 102f)
  }

  private fun rightColsX(spec: PaperSpec): FloatArray {
    val rightBase = 368f + (spec.widthPt - 595f) * 0.65f
    return floatArrayOf(rightBase, rightBase + 34f, rightBase + 68f, rightBase + 102f)
  }

  fun bubbleCenterPt(
    spec: PaperSpec,
    itemNumber: Int,
    choiceIndex: Int,
    itemCount: Int
  ): Pair<Float, Float> {
    val perCol = rowsPerColumn(itemCount)
    val zeroIdx = (itemNumber - 1).coerceAtLeast(0)
    val isRight = zeroIdx >= perCol
    val rowIdx = if (isRight) zeroIdx - perCol else zeroIdx
    val cols = if (isRight) rightColsX(spec) else leftColsX(spec)
    val y = GRID_START_Y_PT + rowIdx * rowStepPt(spec, itemCount)
    return Pair(cols[choiceIndex], y)
  }

  fun itemRowBaselinePt(
    spec: PaperSpec,
    itemNumber: Int,
    itemCount: Int
  ): Pair<Float, Float> {
    val perCol = rowsPerColumn(itemCount)
    val zeroIdx = (itemNumber - 1).coerceAtLeast(0)
    val isRight = zeroIdx >= perCol
    val rowIdx = if (isRight) zeroIdx - perCol else zeroIdx
    val leftLabelX = 68f + (spec.widthPt - 595f) * 0.25f
    val rightLabelX = 322f + (spec.widthPt - 595f) * 0.65f
    val x = if (isRight) rightLabelX else leftLabelX
    val y = GRID_START_Y_PT + rowIdx * rowStepPt(spec, itemCount)
    return Pair(x, y)
  }

  /**
   * Canonical center of the printed row timing tick beside each bubble column.
   * Used by ExamIQPdfModule (print) and ExamIQOmrModule (row-by-row vertical Y-snap).
   */
  fun timingTickCenterPt(
    spec: PaperSpec,
    rowIdx: Int,
    isRightColumn: Boolean,
    itemCount: Int
  ): Pair<Float, Float> {
    val leftTickX = 50f + (spec.widthPt - 595f) * 0.25f
    val rightTickX = 304f + (spec.widthPt - 595f) * 0.65f
    val x = if (isRightColumn) rightTickX else leftTickX
    val y = GRID_START_Y_PT + rowIdx * rowStepPt(spec, itemCount)
    return Pair(x, y)
  }
}

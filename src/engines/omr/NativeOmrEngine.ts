import {NativeModules} from 'react-native';
import {BaseEngine} from '@core/base/BaseEngine';
import {BubbleChoice, OmrSensitivity, PaperSize} from '@core/types/common';
import {ReviewTileView} from '@data/database/SeedData';

export interface NativeOmrAnalysisResult {
  readonly sheetValid?: boolean;
  readonly errorCode?:
    | 'OK'
    | 'NOT_EXAMIQ_SHEET'
    | 'UPSIDE_DOWN'
    | 'NO_MARKERS'
    | 'POOR_ALIGNMENT'
    | 'LOW_LIGHT'
    | 'BLURRY'
    | string;
  readonly errorMessage?: string;
  readonly qrVerifiedOnSheet?: boolean;
  readonly detectedQrPayload?: string;
  readonly markersDetected: number;
  readonly rotationAngleDeg: number;
  readonly lightingStatus: string;
  readonly sharpnessScore: number;
  readonly rawImageUri: string;
  readonly alignedImageUri: string;
  readonly score: number;
  readonly total: number;
  readonly flaggedCount: number;
  readonly halfShadedCount?: number;
  readonly overShadedCount?: number;
  readonly items: ReviewTileView[];
}

interface NativeOmrBridge {
  capturePaperPhoto(): Promise<{rawImageUri: string}>;
  alignAndAnalyzeSheet(
    rawImageUri: string,
    paperSizeCode: string,
    itemCount: number,
    sensitivity: string,
    flagDoubleShade: boolean,
    answerKeyJson: string,
  ): Promise<NativeOmrAnalysisResult>;
}

/**
 * OOP engine wrapping Android's native CameraX capture + paper-size-aware
 * perspective homography alignment + grayscale bubble density OMR classifier.
 */
export class NativeOmrEngine extends BaseEngine {
  private readonly bridge: NativeOmrBridge | undefined;

  constructor() {
    super('NativeOmrEngine');
    this.bridge = NativeModules.ExamIQOmr as NativeOmrBridge | undefined;
  }

  public isNativeAvailable(): boolean {
    return Boolean(
      this.bridge && typeof this.bridge.alignAndAnalyzeSheet === 'function',
    );
  }

  public async initialize(): Promise<void> {
    this.initialized = true;
  }

  public async capturePhoto(): Promise<string | null> {
    if (!this.isNativeAvailable()) {
      return null;
    }
    const result = await this.bridge!.capturePaperPhoto();
    return result.rawImageUri;
  }

  public async alignAndAnalyze(params: {
    rawImageUri: string;
    paperSize: PaperSize;
    itemCount: number;
    sensitivity: OmrSensitivity;
    flagDoubleShade: boolean;
    answerKey: BubbleChoice[];
  }): Promise<NativeOmrAnalysisResult | null> {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.alignAndAnalyzeSheet(
      params.rawImageUri,
      params.paperSize,
      params.itemCount,
      params.sensitivity,
      params.flagDoubleShade,
      JSON.stringify(params.answerKey),
    );
  }
}

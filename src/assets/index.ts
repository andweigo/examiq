import {ImageSourcePropType} from 'react-native';

export type OwlPose =
  | 'checked'
  | 'empty'
  | 'grading'
  | 'reviewing'
  | 'scanning'
  | 'writing';

export class AssetRegistry {
  public static readonly branding = {
    appLogo: require('./branding/examiq-logo.png') as ImageSourcePropType,
  } as const;

  public static readonly mascots: Readonly<Record<OwlPose, ImageSourcePropType>> =
    {
      checked: require('./mascots/owl-checked.png') as ImageSourcePropType,
      empty: require('./mascots/owl-empty.png') as ImageSourcePropType,
      grading: require('./mascots/owl-grading.png') as ImageSourcePropType,
      reviewing: require('./mascots/owl-reviewing.png') as ImageSourcePropType,
      scanning: require('./mascots/owl-scanning.png') as ImageSourcePropType,
      writing: require('./mascots/owl-writing.png') as ImageSourcePropType,
    } as const;

  public static getMascot(pose: OwlPose): ImageSourcePropType {
    return AssetRegistry.mascots[pose];
  }
}

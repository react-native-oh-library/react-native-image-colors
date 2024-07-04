import type { TurboModule } from 'react-native/Libraries/TurboModule/RCTExport';
import { TurboModuleRegistry } from 'react-native';

export type HeadersType = {
  [key: string]: string;
}

export interface Config {
  /**
   * @description Color used when getting color fails. Must be hex
   * @default '#000000'
   */
  fallback: string
  /**
   * @description Android only - The number of pixels to skip between each pixel when
   * calculating the average color. Lower numbers give better results, but take longer.
   * @platform android
   */
  pixelSpacing: number
  /**
   * @default 'low'
   * @description IOS, Web only - The quality of the image to use when getting colors.
   * Lowest give the best performance, highest give the best results
   * @platform ios, web
   */
  quality: 'lowest' | 'low' | 'high' | 'highest'
  /**
   * @description iOS, Android only - Additional headers to send when downloading the image.
   * @platform mobile
   */
  // headers: Record<string, string>
  headers: HeadersType
  /**
   * Enables in-memory caching of the result - skip downloading the same image next time.
   */
  cache: boolean
  /**
   * Key used for caching, it is recommended to provide it. If not provided, the image URI will be used.
   * If the image URI is longer than 500 characters, you must provide a key.
   */
  key: string
}

export interface AndroidImageColors {
  dominant: string
  average: string
  vibrant: string
  darkVibrant: string
  lightVibrant: string
  darkMuted: string
  lightMuted: string
  muted: string
  platform: 'android'
}

export interface WebImageColors {
  dominant: string
  vibrant: string
  darkVibrant: string
  lightVibrant: string
  darkMuted: string
  lightMuted: string
  muted: string
  platform: 'web'
}

export interface IOSImageColors {
  background: string
  primary: string
  secondary: string
  detail: string
  quality: Config['quality']
  platform: 'ios'
}

export interface HarmonyImageColors {
  mainColor: string;
  largestProportionColor: string;
  highestSaturationColor: string;
  averageColor: string;
  platform: 'harmony';
}

export type ImageColorsResult =
  | AndroidImageColors
  | IOSImageColors
  | WebImageColors
  | HarmonyImageColors

export interface Spec extends TurboModule {
  getColors: (uri: string, config?: Object) => Promise<ImageColorsResult>;
}

export default TurboModuleRegistry.get<Spec>('ImageColorsNativeModule') as Spec | null;
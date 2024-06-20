/**
 * MIT License
 *
 * Copyright (C) 2024 Huawei Device Co., Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { TM } from '@rnoh/react-native-openharmony/generated/ts';
import Logger from './Logger';
import image from "@ohos.multimedia.image";
import effectKit from "@ohos.effectKit";
import { BusinessError } from '@kit.BasicServicesKit';
import http from '@ohos.net.http';
import common from '@ohos.app.ability.common';
import buffer from '@ohos.buffer'
import ResponseCode from '@ohos.net.http'

export interface HarmonyImageColors { mainColor: string; largestProportionColor: string; highestSaturationColor: string; averageColor: string; platform: string; }

type Quality = 'lowest' | 'low' | 'high' | 'highest'

interface RGBAColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
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
  quality: Quality
  /**
   * @description iOS, Android only - Additional headers to send when downloading the image.
   * @platform mobile
   */
  headers: Record<string, string>
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

type HeaderType = Record<string, string>

async function loadBase(uri: string): Promise<ArrayBuffer> {
  return new Promise((resolve)=>{
    let buf = buffer.alloc(uri.length, uri)
    resolve(buf.buffer)
  })
}

async function loadHttp(uri: string, headers?: HeaderType): Promise<ArrayBuffer>  {
  return new Promise((resolve, reject)=>{
    let headerObj: HeaderType = {
      'Content-Type': 'application/octet-stream'
    }
    if (headers) {
      headerObj = {...headers}
    }
    http.createHttp().request(uri, headerObj,
      (error: BusinessError, data: http.HttpResponse) => {
        let code: http.ResponseCode | number = data.responseCode
        if (ResponseCode.ResponseCode.OK === code) {
          const imageData = data.result as ArrayBuffer
          Logger.info("http.createHttp success")
          resolve(imageData)
        } else {
          reject(error.message)
        }
      })
  })
}

function rgbaToHex(color: RGBAColor): string {
  if (!color) return undefined

  const { red, green, blue } = color;
  const redHex = red.toString(16).padStart(2, '0');
  const greenHex = green.toString(16).padStart(2, '0');
  const blueHex = blue.toString(16).padStart(2, '0');

  return `#${redHex}${greenHex}${blueHex}`;
}

function getQuality (quality: Config['quality']): number {
  switch (quality) {
    case 'lowest':
      return 10
    case 'low':
      return 5
    case 'high':
      return 1.333
    case 'highest':
      return 1
    default:
      return getQuality('low')
  }
}

export class RNImageColorsTurboModule extends TurboModule implements TM.ImageColorsNativeModule.Spec {
  private context: common.UIAbilityContext

  constructor(ctx: TurboModuleContext) {
    super(ctx);
    this.context = ctx.uiAbilityContext
  }

  private parseFallbackColor(hex: string): string {
    const regex: RegExp = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    if (!regex.test(hex)) {
      throw new Error("Invalid fallback hex color. Must be in the format #ffffff or #fff");
    }

    if (hex.length === 7) {
      return hex;
    }

    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  public getColors(uri: string, config?: Config): Promise<HarmonyImageColors> {
    return new Promise(async (resolve, reject) => {
      let fallback = "#000000"
      if (config && config.fallback) {
        fallback = config.fallback
      }
      const fallbackColor = this.parseFallbackColor(fallback)

      let imageData: ArrayBuffer

      if(uri.startsWith('http')) {
        if (config && config.headers) {
          imageData = await loadHttp(uri, config.headers)
        } else {
          imageData = await loadHttp(uri)
        }
      }

      if (uri.startsWith("asset://")) {
        console.log('uri', uri)
        const filePath = uri.replace('asset://', 'assets/')
        const fileData = await this.context.resourceManager.getRawFileContent(filePath)
        imageData = fileData.buffer.slice(0);
      }

      if (uri.startsWith("data:image")) {
        imageData = await loadBase(uri)
      }

      if (!imageData) {
        reject("Filed to get image")
      }

      const imageSource: image.ImageSource = image.createImageSource(imageData)
      const params = config && config?.quality ? config?.quality : 'low'
      const quality = getQuality(params)
      const imageInfo = await imageSource.getImageInfo(0)
      let decodingOptions: image.DecodingOptions = {
        desiredPixelFormat: 3,
        desiredSize: { width: imageInfo.size.width * quality, height: imageInfo.size.height * quality }
      };

      const pixelMap = await imageSource.createPixelMap(decodingOptions)
      const colorPicker = await effectKit.createColorPicker(pixelMap)
      const mainColor = rgbaToHex(colorPicker.getMainColorSync()) || fallbackColor
      const largestProportionColor = rgbaToHex(colorPicker.getLargestProportionColor()) || fallbackColor
      const highestSaturationColor = rgbaToHex(colorPicker.getHighestSaturationColor()) || fallbackColor
      const averageColor = rgbaToHex(colorPicker.getAverageColor()) || fallbackColor
      const result = { mainColor, largestProportionColor, highestSaturationColor, averageColor, platform: "harmony" }

      pixelMap.release()

      resolve(result)
    })
  }
}
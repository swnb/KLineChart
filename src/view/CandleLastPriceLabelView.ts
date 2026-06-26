/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { YAxisType } from '../common/Styles'
import { formatPrecision, formatThousands, formatFoldDecimal } from '../common/utils/format'
import { isValid } from '../common/utils/typeChecks'
import Animation from '../common/Animation'
import { UpdateLevel } from '../common/Updater'

import View from './View'

import type YAxis from '../component/YAxis'

export default class CandleLastPriceLabelView extends View {
  private _prevPrice: number | null = null
  private _flashUp = false
  private _animationFrameTime = 0
  private _flashDuration = 600

  private readonly _animation = new Animation({ duration: 600, iterationCount: 1 }).doFrame((time) => {
    this._animationFrameTime = time
    const pane = this.getWidget().getPane()
    pane.getChart().updatePane(UpdateLevel.Main, pane.getId())
  })

  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const priceMarkStyles = chartStore.getStyles().candle.priceMark
    const lastPriceMarkStyles = priceMarkStyles.last
    const lastPriceMarkTextStyles = lastPriceMarkStyles.text
    if (priceMarkStyles.show && lastPriceMarkStyles.show && lastPriceMarkTextStyles.show) {
      const precision = chartStore.getPrecision()
      const yAxis = pane.getAxisComponent() as YAxis
      const dataList = chartStore.getDataList()
      const data = dataList[dataList.length - 1]
      if (isValid(data)) {
        const { close, open } = data
        const priceY = yAxis.convertToNicePixel(close)
        let backgroundColor: string
        if (close > open) {
          backgroundColor = lastPriceMarkStyles.upColor
        } else if (close < open) {
          backgroundColor = lastPriceMarkStyles.downColor
        } else {
          backgroundColor = lastPriceMarkStyles.noChangeColor
        }
        const flashStyles = lastPriceMarkStyles.flash
        if (flashStyles.show) {
          if (this._prevPrice !== null && close !== this._prevPrice) {
            this._flashUp = close > this._prevPrice
            this._animationFrameTime = 0
            this._flashDuration = flashStyles.duration
            this._animation.stop()
            this._animation.setDuration(flashStyles.duration).start()
          }
          this._prevPrice = close
        }
        let text: string
        if (yAxis.getType() === YAxisType.Percentage) {
          const fromData = chartStore.getVisibleFirstData()
          const fromClose = fromData!.close
          text = `${((close - fromClose) / fromClose * 100).toFixed(2)}%`
        } else {
          text = formatPrecision(close, precision.price)
        }
        text = formatFoldDecimal(formatThousands(text, chartStore.getThousandsSeparator()), chartStore.getDecimalFoldThreshold())
        let x: number
        let textAlgin: CanvasTextAlign
        if (yAxis.isFromZero()) {
          x = 0
          textAlgin = 'left'
        } else {
          x = bounding.width
          textAlgin = 'right'
        }
        const flashProgress = this._animationFrameTime / this._flashDuration
        if (flashStyles.show && this._animationFrameTime > 0 && flashProgress < 1) {
          const flashBg = this._flashUp ? lastPriceMarkStyles.upColor : lastPriceMarkStyles.downColor
          ctx.save()
          ctx.globalAlpha = 1 - flashProgress
          this.createFigure({
            name: 'text',
            attrs: {
              x,
              y: priceY,
              text,
              align: textAlgin,
              baseline: 'middle'
            },
            styles: {
              ...lastPriceMarkTextStyles,
              backgroundColor: flashBg
            }
          })?.draw(ctx)
          ctx.restore()
        }
        this.createFigure({
          name: 'text',
          attrs: {
            x,
            y: priceY,
            text,
            align: textAlgin,
            baseline: 'middle'
          },
          styles: {
            ...lastPriceMarkTextStyles,
            backgroundColor
          }
        })?.draw(ctx)
      }
    }
  }
}

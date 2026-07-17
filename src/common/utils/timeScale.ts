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

import type Nullable from '../Nullable'
import { binarySearchNearest } from './number'

interface TimestampedData { timestamp: number }

const BAR_TIMESPAN_LOOKBACK = 8

/**
 * Trade fork: infer the bar timespan (ms) from the tail of the data list.
 * Uses the minimum positive delta over the last few bars so a single data
 * gap does not double the inferred span. Returns null when the list has
 * fewer than 2 bars or no positive delta exists in the lookback window.
 */
export function inferBarTimespan (dataList: TimestampedData[]): Nullable<number> {
  const count = dataList.length
  if (count < 2) {
    return null
  }
  let best: Nullable<number> = null
  const lookback = Math.min(count - 1, BAR_TIMESPAN_LOOKBACK)
  for (let i = 0; i < lookback; i++) {
    const span = dataList[count - 1 - i].timestamp - dataList[count - 2 - i].timestamp
    if (span > 0 && (best === null || span < best)) {
      best = span
    }
  }
  return best
}

/**
 * Trade fork: dataIndex -> timestamp that keeps working outside the loaded
 * range by extrapolating along the inferred bar grid (TV-style whitespace
 * time). In-range indexes return the real bar timestamp; out-of-range ones
 * return null only when no bar timespan can be inferred.
 */
export function extrapolateTimestampFromDataIndex (dataList: TimestampedData[], dataIndex: number): Nullable<number> {
  const count = dataList.length
  if (count === 0) {
    return null
  }
  if (dataIndex >= 0 && dataIndex < count) {
    return dataList[dataIndex].timestamp
  }
  const span = inferBarTimespan(dataList)
  if (span === null) {
    return null
  }
  if (dataIndex >= count) {
    return dataList[count - 1].timestamp + (dataIndex - (count - 1)) * span
  }
  return dataList[0].timestamp + dataIndex * span
}

/**
 * Trade fork: timestamp -> dataIndex that extrapolates outside the loaded
 * range instead of clamping to the edge bars (binarySearchNearest clamps,
 * which pins future-anchored overlay points onto the last bar). Falls back
 * to the clamped edge index when no bar timespan can be inferred.
 */
export function extrapolateDataIndexFromTimestamp (dataList: TimestampedData[], timestamp: number): number {
  const count = dataList.length
  if (count === 0) {
    return 0
  }
  const firstTimestamp = dataList[0].timestamp
  const lastTimestamp = dataList[count - 1].timestamp
  if (timestamp >= firstTimestamp && timestamp <= lastTimestamp) {
    return binarySearchNearest(dataList, 'timestamp', timestamp)
  }
  const span = inferBarTimespan(dataList)
  if (span === null) {
    return timestamp > lastTimestamp ? count - 1 : 0
  }
  if (timestamp > lastTimestamp) {
    return (count - 1) + Math.round((timestamp - lastTimestamp) / span)
  }
  return Math.round((timestamp - firstTimestamp) / span)
}

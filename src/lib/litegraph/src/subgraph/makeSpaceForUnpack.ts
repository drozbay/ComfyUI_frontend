import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Positionable, ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { getCentre, overlapBounding } from '@/lib/litegraph/src/measure'

import type { GraphOrSubgraph } from './Subgraph'

/** Empty canvas left between the cleared area and the items shifted aside. */
const DEFAULT_GAP = 40

export interface MakeSpaceOptions {
  /** Empty canvas left between the cleared area and the items shifted aside. */
  gap?: number
  /** Items that should never be moved, e.g. the subgraph node being unpacked. */
  exclude?: ReadonlySet<Positionable>
}

export interface MakeSpaceResult {
  /** Distance everything left of the cleared area moved. */
  shiftedLeftBy: number
  /** Distance everything right of the cleared area moved. */
  shiftedRightBy: number
  movedItemCount: number
}

/**
 * Clears a rectangular area of the graph by splitting everything else into a
 * left half and a right half and sliding the two halves apart, like opening a
 * curtain.
 *
 * Each half is translated as a rigid block by a single distance: the smallest
 * shift that gets every item on that side out of {@link clearRect}. Items are
 * deliberately not pushed individually to the edge of the cleared area, because
 * that flattens them into a column against it and destroys the layout the user
 * had. Moving the whole side by one amount keeps every node's spacing relative
 * to its neighbours exactly as it was.
 *
 * Used when a subgraph is unpacked: the nodes coming out of the subgraph need
 * far more room than the single subgraph node occupied, and without this they
 * are simply dropped on top of the surrounding graph.
 * @param graph The graph that owns the area being cleared.
 * @param clearRect The area to clear, as `x, y, width, height`.
 * @param options See {@link MakeSpaceOptions}.
 * @returns How far each side moved, and how many items were moved in total.
 */
export function makeSpaceForRect(
  graph: LGraph | GraphOrSubgraph,
  clearRect: ReadOnlyRect,
  options: MakeSpaceOptions = {}
): MakeSpaceResult {
  const gap = options.gap ?? DEFAULT_GAP
  const exclude = options.exclude ?? new Set<Positionable>()

  const clearLeft = clearRect[0]
  const clearRight = clearRect[0] + clearRect[2]
  const clearCentreX = getCentre(clearRect)[0]

  const itemsOnLeft: Positionable[] = []
  const itemsOnRight: Positionable[] = []
  let shiftedLeftBy = 0
  let shiftedRightBy = 0

  for (const item of collectTopLevelItems(graph, exclude)) {
    const rect = item.boundingRect
    const belongsOnLeft = getCentre(rect)[0] < clearCentreX

    if (belongsOnLeft) itemsOnLeft.push(item)
    else itemsOnRight.push(item)

    // Only items actually in the way decide how far their side has to travel;
    // the rest come along to keep the side's internal spacing intact.
    if (!overlapBounding(clearRect, rect)) continue

    if (belongsOnLeft) {
      const overlap = rect[0] + rect[2] - (clearLeft - gap)
      shiftedLeftBy = Math.max(shiftedLeftBy, overlap)
    } else {
      const overlap = clearRight + gap - rect[0]
      shiftedRightBy = Math.max(shiftedRightBy, overlap)
    }
  }

  let movedItemCount = 0
  if (shiftedLeftBy > 0) {
    for (const item of itemsOnLeft) moveItemHorizontally(item, -shiftedLeftBy)
    movedItemCount += itemsOnLeft.length
  }
  if (shiftedRightBy > 0) {
    for (const item of itemsOnRight) moveItemHorizontally(item, shiftedRightBy)
    movedItemCount += itemsOnRight.length
  }

  return { shiftedLeftBy, shiftedRightBy, movedItemCount }
}

/**
 * Shifts a single item along X.
 *
 * {@link LGraphNode.move} is a no-op while Vue nodes own layout, so nodes are
 * moved by assigning their position, which commits through the layout store.
 * Groups move their children the same way rather than delegating to
 * {@link LGraphGroup.move}, which would hit that same no-op.
 */
function moveItemHorizontally(item: Positionable, deltaX: number): void {
  if (item.pinned) return

  if (item instanceof LGraphNode) {
    item.setPos(item.pos[0] + deltaX, item.pos[1])
    return
  }

  if (item instanceof LGraphGroup) {
    item.move(deltaX, 0, true)
    for (const child of item.children) {
      moveItemHorizontally(child, deltaX)
    }
    return
  }

  item.move(deltaX, 0)
}

/**
 * Collects the items that can be moved independently: groups, and the nodes and
 * reroutes that are not inside a group. Items inside a group are left alone
 * because moving the group already moves them.
 */
function collectTopLevelItems(
  graph: LGraph | GraphOrSubgraph,
  exclude: ReadonlySet<Positionable>
): Positionable[] {
  const itemsOwnedByAGroup = new Set<Positionable>()
  for (const group of graph.groups) {
    group.recomputeInsideNodes()
    for (const child of group.children) {
      itemsOwnedByAGroup.add(child)
    }
  }

  const isMovable = (item: Positionable) =>
    !exclude.has(item) && !itemsOwnedByAGroup.has(item) && !item.pinned

  return [...graph.groups, ...graph.nodes, ...graph.reroutes.values()].filter(
    isMovable
  )
}

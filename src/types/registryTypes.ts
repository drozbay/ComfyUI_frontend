// TODO
export enum NodeStatus {
  ACTIVE = 'active',
  PENDING = 'pending'
}

export interface NodeResults {
  /**
   * The node name
   */
  node: string
  /**
   * The pack items
   */
  item: NodePack
  /**
   * The node key
   * @example
   * ```
   * const nodePack = "ComfyUI-Impact-Pack"
   * const nodeName = "AnyPipeToBasic"
   * // --> "ComfyUI Impact Pack-AnyPipeToBasic"
   * ```
   */
  key: string
}

export interface NodePack {
  /**
   * Names of nodes that are in this pack
   *
   */
  comfy_nodes: string[]
  /**
   * The pack name
   */
  name: string
  /**
   * The pack publisher ID
   */
  publisher_id: string
  /**
   * The pack total install count
   */
  total_install: number
  /**
   * The pack update time formatted as a date string
   * @example "2025-02-24T07:59:47.972974Z"
   */
  update_time: string
  /**
   * The pack status
   */
  status: NodeStatus
  /**
   * The pack description
   */
  description: string
  /**
   * cnr_id (?)
   */
  objectID: string
  /**
   * The pack repository URL
   */
  repository_url: string
  /**
   * The pack license
   */
  license: string
  /**
   * The semantic version of the latest version
   */
  latest_version: string
  /**
   * The latest version status
   */
  latest_version_status: string
}

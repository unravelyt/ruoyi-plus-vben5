import type { MaybePromise } from '@vben/types';

import type { useVbenVxeGrid } from '#/adapter/vxe-table';

/**
 * 保存表格滚动/展开状态并执行回调 用于树表在执行 新增/编辑/删除等操作后 依然在当前位置(体验优化)
 *
 * @param tableApi 表格api
 * @param callback 回调
 */
export async function preserveTreeTableState(
  tableApi: ReturnType<typeof useVbenVxeGrid>[1],
  callback: () => MaybePromise<void>,
) {
  // 保存当前状态
  const scrollState = tableApi.grid.getScroll();
  const expandRecords = tableApi.grid.getTreeExpandRecords();

  // 执行回调
  await callback();

  // 恢复状态
  tableApi.grid.setTreeExpand(expandRecords, true);
  tableApi.grid.scrollTo(scrollState.scrollLeft, scrollState.scrollTop);
}

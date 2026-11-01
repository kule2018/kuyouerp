# Element Plus → DeepSeek UI 迁移指南

全站移除 Element Plus，所有 `el-*` 改为 `src/components` 下的 Ds/Base 组件。
Ds* / Base* 已通过 `installDsUi(app)` 全局注册，**无需 import 即可在模板使用**。
目标：零 `el-` 残留、业务/接口逻辑不变、构建通过（`npx vue-tsc --noEmit` + `npm run build`）。

## 通用规则
- 移除所有 `import ... from 'element-plus'`、`import ... from '@element-plus/icons-vue'`。
- 移除 `ElMessage / ElMessageBox / ElNotification / ElLoading`：
  - `ElMessage.success/error/warning/info(msg)` → `import { useToast } from '@/components'`(按路径) 或 `import { useToast } from './components/ds/toast'`；调用 `const toast = useToast(); toast.success(msg)`。
  - `ElMessageBox.confirm(msg, title, {...}).then(...).catch(...)` → 用本地 `ref + DsModal` 做确认弹窗；或临时用 `window.confirm`（不推荐，仅作兜底）。
- `el-config-provider` 整块删除。
- 布局原语 `el-container/el-aside/el-header/el-main/el-footer` → `<div>` + flex；`el-row/el-col` → `<div>` + flex/grid（用 `style="display:flex;gap:12px"` 或 `:style`）。

## 组件映射

### el-button → DsButton
- `type="primary|success|warning|danger|info|text"` → `variant="primary|default|default|danger|default|text"`（info/success→default）
- `size="large|default|small"` → `size="lg|md|sm"`
- `plain` → `variant="ghost"`
- `:loading :disabled @click` 不变；`round/circle` 用 class 近似或忽略；`icon` 插槽 → `#icon` 插槽
- 例：`<el-button type="primary" size="small" :loading="s" @click="save">保存</el-button>`
  → `<DsButton variant="primary" size="sm" :loading="s" @click="save">保存</DsButton>`

### el-input → DsInput
- `v-model` 不变；`placeholder/size(=>sm|md|lg)/clearable/disabled/readonly` 不变
- `type="textarea"` → `type="textarea"`；`type="password"` → `type="password"`
- `maxlength` + `show-word-limit` → `:maxlength` + `show-count`
- `prefix/suffix` 插槽 → `#prefix` / `#suffix`
- `@input`/`@change` 事件名不变

### el-input-number → DsInput
- → `<DsInput type="number" v-model="x" :min :max :step />`（DsInput 已做数字合法化）

### el-select + el-option → DsSelect
- `v-model` 不变；`placeholder/clearable/filterable/multiple/disabled/size` 不变
- **删除所有 `<el-option>` 子节点**，改为 `:options="[{label,value,disabled}]"`（数组从原 options 映射）
- `el-option-group` → 展平进 options（或忽略分组）
- `@change` 不变；`@visible-change` 等移除

### el-date-picker → DsDatePicker
- `v-model`(string) 不变；`type="date|datetime"` → `type="date|datetime"`（time→time）
- `placeholder/clearable/disabled` 不变
- `value-format` 忽略（DsDatePicker 统一 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm'）
- 不支持 `daterange`/`monthrange`：若源用 range，改为两个单日期框或自定义，并保留导出逻辑不变
- `@change` 不变（不依赖 Element 的日期对象）

### el-table + el-table-column → DsTable
- `<el-table :data="rows" v-loading="loading" stripe row-key="id" @row-click="onRow" empty-text="x">`
  → `<DsTable :columns="cols" :data="rows" :loading="loading" striped row-key="id" @row-click="onRow" empty-text="x" :selection="hasSelection" @selection-change="onSel">`
- 列定义 `cols`：在 `<script>` 里声明 `const cols = [{ title, key, width, align, fixed, sortable, formatter, slot }]`
  - 纯字段列：`{ title:'名称', key:'name', width:'160px' }`
  - 固定列：加 `fixed:'left'|'right'`
  - 排序列：加 `sortable:true`（组件 emit `sort-change`）
  - 格式化：`formatter:(v,row,i)=>...`
- 原 `<el-table-column>` 带 `<template #default="{row,index}">` 的自定义列：
  - 在 `cols` 里加 `{ title, key:'act', slot:true }`（key 用唯一标识）
  - 在 `<DsTable>` 内写 `<template #act="{ row, index, value }"> ...原模板内容... </template>`
  - 注意：原 `#default` 插槽作用域变量是 `{ row, $index }`，DsTable 给的是 `{ row, index, value }`，把 `$index` 改为 `index`
- 多选：`DsTable` 加 `:selection="true"` + `@selection-change="rows=>selected=rows"`（回传选中行数组）
- `el-table-column type="selection"` 与 `type="index"`：selection 用上面的 `:selection`；index 用 `formatter:(v,r,i)=>i+1` 或加一列 `{title:'#',key:'__idx',width:'60px',formatter:(v,r,i)=>i+1}`

### el-pagination → DsPagination
- `:current-page="p" :page-size="s" :total="t" :page-sizes="ps" layout="total, sizes, prev, pager, next, jumper"`
  → `:currentPage="p" :pageSize="s" :total="t" :pageSizes="ps" layout="total, sizes, prev, pager, next, jumper"`
- `@current-change="f"` → `@update:currentPage="f"`；`@size-change="f"` → `@update:pageSize="f"`
  （或统一用 `@change="(page,size)=>..."`）

### el-dialog → DsModal
- `v-model="visible"` 不变；`title` 不变；`width="500"` → `:width="500"`
- `:close-on-click-modal="false"` → `:close-on-mask="false"`；`:show-close` → `:closable`
- 内容放默认插槽；底部按钮放 `#footer` 插槽（原 el-dialog 的 `#footer` 或 `#default` 底部按钮区）
- `top`/`fullscreen`/`append-to-body` 忽略（DsModal 居中）；`destroy-on-close` 用 `v-if` 包裹内容近似

### el-drawer → DsDrawer（或 BaseDrawer）
- `v-model` 不变；`title` 不变；`size="40%"` → `:size="'40%'"` 或 `:size="420"`；`direction="rtl|ltr|ttb|btt"` → `placement="right|left|top|bottom"`
- `:close-on-click-modal` → `:mask-closable`；`:show-close` → `:closable`
- 内容 `#default`；底部 `#footer`；头部 `#header`
- 例：`<el-drawer v-model="d" title="详情" size="50%" direction="rtl">...</el-drawer>`
  → `<DsDrawer v-model="d" title="详情" :size="'50%'" placement="right">...</DsDrawer>`

### el-tabs + el-tab-pane → DsTabs
- `v-model="tab"` 不变；`el-tab-pane` 改为 `:items="[{label,value,disabled,badge}]"`
- `type="card|border-card"` → `variant="pill"`；`@tab-change` → `@change`
- 例：`<el-tabs v-model="t"><el-tab-pane label="全部" name="all"/><el-tab-pane label="待审" name="wait"/></el-tabs>`
  → `<DsTabs v-model="t" :items="[{label:'全部',value:'all'},{label:'待审',value:'wait'}]" />`

### el-menu / el-sub-menu / el-menu-item / el-menu-item-group → DsMenu
- 构建 `items: NavItem[]`（`{ label, to, icon, children }`），`icon` 用 SVG path d 字符串或 1-6 字符文本
- `<DsMenu :model-value="active" :items="items" @select="onSelect" />`；`onSelect(item)` 内 `router.push(item.to)`
- 多级：父项 `children:[...]`；`el-menu-item-group` 的 title 变成父项 label，其下 menu-item 变 children
- 原 `el-icon`+`<DataLine/>` 之类：用对应 SVG path d（无图标库时可用字符如 '▦' 或简短文本）

### el-form / el-form-item → DsField（或 BaseForm）
- `el-form` 整块删除外层标签，内部 `el-form-item` 逐个换 `<DsField label="..." required :error="err.x"> ...控件... </DsField>`
- `label-width` 由 DsField 全局样式处理；`inline` 用外层 `<div style="display:flex;flex-wrap:wrap;gap:16px">`
- `:rules/prop` 校验逻辑保留在脚本（手动校验或保留原校验函数），`error` 通过 DsField 的 `:error` 显示
- `el-form label-position="top"` → DsField 默认即顶部标签（已是）

### el-tag → DsTag
- `type="success|info|warning|danger|primary"` → `color="success|neutral|warning|danger|brand"`
- `effect="plain|dark|light"` → `variant="outline|solid|soft"`
- `closable @close` 不变；`size="small"` → `size="sm"`

### el-card → DsCard
- `header` 插槽 → `#title` 插槽（或 `title` prop）；`#default` 不变
- `shadow="hover|always|never"` → `hoverable`；`body-style` 用内部 CSS

### el-checkbox → DsCheckbox
- 独立：`<DsCheckbox v-model="agree">同意</DsCheckbox>`（boolean）
- 组：多个 `<DsCheckbox v-model="list" :value="opt">` 共享同一数组 model

### el-radio / el-radio-group → DsRadio
- `<DsRadio v-model="r" :value="a">A</DsRadio>` `<DsRadio v-model="r" :value="b">B</DsRadio>`

### el-switch → DsSwitch
- `v-model`(boolean) 不变；`active-text/inactive-text` → `checkedText/uncheckedText`；`:disabled :loading` 不变；`@change` 不变

### el-tree → DsTree
- `:data` → `:data`；`:props="{label,children}"` → `:label-key :children-key`；`node-key` → `:node-key`
- `show-checkbox` → `checkable`；`:default-expanded-keys` → `:default-expanded-keys`
- `lazy :load="load"` → `lazy :lazy-load="(node,resolve)=>load(node,resolve)"`
- `highlight-current` → `highlight-current`（默认 true）；`@node-click` → `@select`；`@check` → `@check`
- `filter-node-method` → `filterable` + `ref.filter(kw)`；`:expand-on-click-node` → `:expand-on-click`
- `:render-content` 等高级用法：用 `#default` 插槽不容易，改用事件回调 + 数据预处理

### el-upload → DsUploader
- `<DsUploader :accept :multiple :max-size :tip @select="files=>upload(files)" @error="toast.error" />`
- DsUploader 只选文件不自动上传，父组件拿到 File[] 后自行上传（保留原 action 逻辑）

### el-descriptions / el-descriptions-item → DsDescriptions
- 构建 `items:[{label,key,span,formatter}]` 与 `:data="row"`
- 原 `#default` 自定义某项 → `<template #item-字段名="{ value }"> ... </template>`

### el-popover → DsPopover
- `#reference` 插槽不变；`#default` 内容不变；`placement`(top/bottom/left/right) 不变；`trigger="hover"` → `trigger="hover"`；`title` → `title`/`#title`

### el-tooltip → DsTooltip
- `:content` 不变；`placement` 不变；默认 hover

### el-alert → DsAlert
- `type`(info/success/warning/danger) 不变；`title`/`description`/`#default` 不变；`closable/show-icon` 不变

### el-empty → DsEmpty
- `description` → `title`（或 `title`）；`#default`/`#action` 不变

### el-breadcrumb/el-breadcrumb-item → DsBreadcrumb（按 DsBreadcrumb 实际 props 适配）
### el-avatar → DsAvatar；el-badge → DsBadge；el-progress → DsProgress；el-steps/el-step → DsSteps；el-collapse/el-collapse-item → DsCollapse/DsCollapseItem；el-cascader → DsCascader；el-slider → DsSlider；el-rate → DsRate；el-result → DsResult；el-skeleton → DsSkeleton；el-segmented → DsSegmented
- 按各 Ds 组件真实 props 适配（先 Read 对应文件确认 API）。

## 完成后
- 确认文件内无任何 `el-` 标签、`element-plus` import。
- 运行 `npx vue-tsc --noEmit` 与 `npm run build` 验证。

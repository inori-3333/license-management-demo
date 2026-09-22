---
{
  "version": "alpha",
  "name": "持证上岗统计分析系统",
  "colors": {
    "primary": "#0072b3",
    "primary-hover": "#005d94",
    "blue-soft": "#eaf5fc",
    "surface": "#ffffff",
    "background": "#f2f7fb",
    "text": "#213b50",
    "muted": "#5b7082",
    "border": "#dce7ef",
    "scrollbar": "#9fb7c9",
    "table-head": "#f3f8fb",
    "table-hover": "#f0f8fd",
    "sidebar": "#064775",
    "sidebar-hover": "#0d5b8c",
    "sidebar-active": "#0076b9",
    "sidebar-text": "#ffffff",
    "sidebar-muted": "#d8ebf8",
    "sidebar-border": "#3b739a",
    "sidebar-accent": "#43c5e9",
    "sidebar-status": "#68d4ba",
    "success": "#12775c",
    "success-soft": "#eaf7f0",
    "warning": "#995f05",
    "warning-soft": "#fff6e4",
    "danger": "#c23b47",
    "danger-soft": "#fff0f1",
    "flow-background": "#101f35",
    "flow-surface": "#182e48",
    "flow-text": "#f3f7ff",
    "flow-muted": "#b9c8dc",
    "flow-cyan": "#51d7e6",
    "flow-blue": "#acbeff",
    "flow-violet": "#c5acff",
    "flow-amber": "#ffc86a",
    "flow-coral": "#ff9e9e",
    "flow-mint": "#79e1b3"
  },
  "typography": {
    "body": {
      "fontFamily": "-apple-system, BlinkMacSystemFont, \"PingFang SC\", \"Microsoft YaHei\", sans-serif",
      "fontSize": "14px"
    },
    "table": {
      "fontFamily": "-apple-system, BlinkMacSystemFont, \"PingFang SC\", \"Microsoft YaHei\", sans-serif",
      "fontSize": "14px"
    },
    "compact": {
      "fontFamily": "-apple-system, BlinkMacSystemFont, \"PingFang SC\", \"Microsoft YaHei\", sans-serif",
      "fontSize": "13px"
    },
    "caption": {
      "fontFamily": "-apple-system, BlinkMacSystemFont, \"PingFang SC\", \"Microsoft YaHei\", sans-serif",
      "fontSize": "12px"
    }
  },
  "rounded": {
    "control": "7px",
    "panel": "10px"
  }
}
---

## Overview

中文电力企业持证管理工作台。首页先展示待处理事项，再以可比较的单位持证矩阵呈现整体状况，强调岗位来源、证书缺口与整改行动。面向人资、安全及专业管理人员，桌面为主，窄屏保留完整操作。采用用户于 2026-09-22 选定的第二张配色方案：深海蓝导航、白色顶栏与面板、浅蓝灰工作区，不使用营销式大幅装饰。

## Colors

颜色由上方 tokens 唯一维护，scripts/tokens.mjs 生成 src/tokens.css；所有组件通过 CSS 变量消费。蓝色用于行动与选择，红色用于当期不符合要求，橙色用于提醒，绿色用于有效持证和完成。状态均同时提供文字。

品牌方向参考华电的天蓝与海蓝，界面色值是本项目的设计适配值，并非官方 VI 标准色。sidebar-* tokens 由侧栏、手机品牌栏共用：白字与浅蓝辅助文字保持可读性，选中项使用海蓝底和青色左侧标记，键盘焦点使用青色轮廓。主内容区的按钮、图表、表格选中与演示控件继续消费 primary / blue-soft，保留红橙绿业务语义。

## Typography

标题与正文采用本机中文无衬线字体，数据使用等宽数字。正文与舒适表格 14px，紧凑表格 13px，辅助文字不小于 12px，主标题 26px；单位矩阵为紧凑比较视图。字体尺寸由上方 typography tokens 生成 --text-body / --text-table / --text-compact / --text-caption，表格数字使用等宽数字并对齐。中文标签完整，长内容换行或详情展开。

## Layout

224px 侧边导航与自然高度主内容，主内容最大 1800px。1000px 下导航收窄并提供文字菜单，640px 下使用品牌与导航按钮；人员、整改与报表在手机宽度使用摘要卡片，其他表格独立横向滚动，固定关键列且提供滚动提示。长表单保持自然高度。页面、详情、导入与编辑使用共享结构。

## Elevation & Depth

内容面板以边框划分，弹窗使用遮罩和轻阴影，其他页面不依赖阴影表达层次。

## Shapes

控件 7px、面板 10px 圆角；状态徽标使用紧凑小圆角，不以装饰性胶囊堆叠内容。

## Components

BrandMark 在桌面、折叠侧栏和手机品牌栏复用华电官方网站原始 PNG，以白色底板承托天蓝与海蓝标识。资源源址、尺寸和展示裁切范围记录于 src/assets/README.md；不重绘或滤镜改色。标识由 Vite 打包为本地资源，部署子路径与离线使用不依赖官网图片服务。

首次打开或刷新文档时，HTML 入口先展示白底居中开场：华电原始图标、海蓝色“启航华电 15 组”、蓝色细载入条。图标裁切样式由 src/brand.css 与 BrandMark 共用，配色和字体消费现有 tokens。图文轻柔上浮，下方名单按指定顺序分两行、每行 10 人，只显示姓名，使用华电蓝从上行到下行逐人高亮，每人约 180 毫秒。至少完成一轮名单高亮且应用首次提交完成后才收满载入条，再淡出进入原页面；窄屏名单保持两行并独立横向滚动，自动跟随当前高亮姓名，短屏改为自然排列以避免遮挡。条形表示启动过程，不显示模拟百分比。站内导航不重播，减少动态效果时取消动效和刻意等待。启动期间背景不可聚焦；资源加载失败显示重新载入操作。

Field/Select/TextAreaField 管理关联标签；BusinessForm 管理校验与提交；Modal 使用原生 dialog 的模态焦点；Table 管理分页、排序、固定列、溢出提示与手机摘要；Provider 管理唯一通知。SearchPicker 复用 Modal、SearchField 和原生专业筛选，以搜索对话框选择岗位，不将 628 个岗位塞入单一下拉菜单。RuleConditions 显示组间且、组内或的条件。App 管理全局表格密度并保存显示偏好。AutoDemo 在当前应用界面中操作。讲解卡片随目标位置避让布局，使用现有蓝色、面板圆角与正文 tokens；可见指针、点击反馈与聚焦框共同标记当前操作。讲解按业务流程合并为 19 段；操作开始即逐字变色，字幕随实际操作推进，最后一个操作完成时全蓝，保留 1.2 秒结果停留，并预告下一段。操作提示最多两行，仅在操作时显示，空闲时留白。结果停留期间保持页面、焦点与卡片稳定；同一业务区域优先保留卡片位置，已可见控件不重复滚动居中。正常业务弹窗保持原有样式，讲解与指针通过手动 Popover 放在当前弹窗内的顶层。原生选择器与日期控件允许操作系统弹出界面，应用自有内容全部使用 zh-CN。

演示末尾以主内容中的 FlowOverview 收束 19 个环节。导图采用深蓝底，青色数据、蓝色台账、紫色规则、琥珀色预警、珊瑚色整改、薄荷色分析六个阶段；这些颜色仅区分导图阶段，不替代业务状态语义。flow-* tokens 与全站 tokens 同源生成。桌面用折返连线表达主流程，整改回连台账表示补证后重新校验；窄屏改为纵向流。编号保留原演示环节，点击阶段在图下展示对应讲解，窄屏就地展开说明。流动仅发生在连线上，可暂停，系统减少动态效果时静止；页面不自动切换或滚动。设置与备份作为支撑带，避免将它们误认为必经业务步骤。

## Do's and Don'ts

保持指标分子分母可解释；未知与无适用要求独立显示。使用共享组件，避免浏览器 alert/confirm/prompt。动态尊重 reduced motion。确认删除、重置与恢复，普通保存直接执行。

## Knowledge Graph

知识图谱 `/knowledge-graph` 默认按共同证书展示全量三维人员点云，也支持相同岗位、公司、专业；`view=entities` 保留原实体关系追溯视图。使用原工作台导航、SearchField、Select 与白色详情区，三维场景复用 flow-background / flow-surface / flow-text / flow-muted 与六种 flow 分类色。相机透视决定点的大小、明暗与遮挡；画布中不设置中心人数圆盘、圆形簇边界或簇分页。

每人恰好一个三维数据点。所有共同关系共同牵引坐标，持证组合相同的人员形成局部点云，多证人员不复制；无当前关系人员仍保留为灰色点。所有人员同时保留在空间中。缓慢环绕与三维漂浮支持暂停与 reduced-motion。拖拽与方向键旋转视角、滚轮或按钮缩放；点击人员点后，相机以约 1.25 秒旋转并拉近该人员所属簇，其余数据仍保留为背景点。多证人员首次选择优先聚焦成员较少的证书簇，可以在详情切换其他证书；同一簇内再次选人保持当前簇。系统减少动态效果时立即定位。

证书簇默认仅当前有效持证，可切换全部持证记录，按人员去重并保留每条记录状态；证书别名复用既有归并，不将高级证书推断成其他证书。岗位、公司与专业按当前有效任职归集，岗位名称复用既有别名。目录按需加载，完整成员列表按 30 人分页并支持簇内搜索；名单分页不改变三维点云。类型选择保存于 URL，人员搜索与镜头状态不持久化。Canvas 是千人点云的专用绘制层，旁边的原生按钮、目录和成员名单提供同等选择与聚焦入口。

850px 以下详情位于画布下方；点击数据点保留镜头画面，不自动把用户滚走。手机同样保留全部人员。原实体关系视图仍由 GraphCanvas 绘制，旧六类实体颜色与业务状态语义保持不变。

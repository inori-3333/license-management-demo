---
{
  "version": "alpha",
  "name": "持证上岗统计分析系统",
  "colors": {
    "primary": "#2558d8",
    "primary-hover": "#1d46b0",
    "blue-soft": "#edf3ff",
    "surface": "#ffffff",
    "background": "#f5f7fb",
    "text": "#24324b",
    "muted": "#606d82",
    "border": "#e4e9f1",
    "scrollbar": "#aebbcf",
    "table-head": "#f8f9fc",
    "table-hover": "#f9fbff",
    "success": "#12775c",
    "success-soft": "#eaf7f0",
    "warning": "#995f05",
    "warning-soft": "#fff6e4",
    "danger": "#c23b47",
    "danger-soft": "#fff0f1"
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

中文电力企业持证管理工作台。首页先展示待处理事项，再以可比较的单位持证矩阵呈现整体状况，强调岗位来源、证书缺口与整改行动。面向人资、安全及专业管理人员，桌面为主，窄屏保留完整操作。浅色界面，不使用营销式大幅装饰。

## Colors

颜色由上方 tokens 唯一维护，scripts/tokens.mjs 生成 src/tokens.css；所有组件通过 CSS 变量消费。蓝色用于行动与选择，红色用于当期不符合要求，橙色用于提醒，绿色用于有效持证和完成。状态均同时提供文字。

## Typography

标题与正文采用本机中文无衬线字体，数据使用等宽数字。正文与舒适表格 14px，紧凑表格 13px，辅助文字不小于 12px，主标题 26px；单位矩阵为紧凑比较视图。字体尺寸由上方 typography tokens 生成 --text-body / --text-table / --text-compact / --text-caption，表格数字使用等宽数字并对齐。中文标签完整，长内容换行或详情展开。

## Layout

224px 侧边导航与自然高度主内容，主内容最大 1800px。1000px 下导航收窄并提供文字菜单，640px 下使用品牌与导航按钮；人员、整改与报表在手机宽度使用摘要卡片，其他表格独立横向滚动，固定关键列且提供滚动提示。长表单保持自然高度。页面、详情、导入与编辑使用共享结构。

## Elevation & Depth

内容面板以边框划分，弹窗使用遮罩和轻阴影，其他页面不依赖阴影表达层次。

## Shapes

控件 7px、面板 10px 圆角；状态徽标使用紧凑小圆角，不以装饰性胶囊堆叠内容。

## Components

Field/Select/TextAreaField 管理关联标签；BusinessForm 管理校验与提交；Modal 使用原生 dialog 的模态焦点；Table 管理分页、排序、固定列、溢出提示与手机摘要；Provider 管理唯一通知。SearchPicker 复用 Modal、SearchField 和原生专业筛选，以搜索对话框选择岗位，不将 628 个岗位塞入单一下拉菜单。RuleConditions 显示组间且、组内或的条件。App 管理全局表格密度并保存显示偏好。原生选择器与日期控件允许操作系统弹出界面，应用自有内容全部使用 zh-CN。

## Do's and Don'ts

保持指标分子分母可解释；未知与无适用要求独立显示。使用共享组件，避免浏览器 alert/confirm/prompt。动态尊重 reduced motion。确认删除、重置与恢复，普通保存直接执行。

import type { Directive, DirectiveBinding } from 'vue';
import { hasPerm } from '../permission';

/**
 * v-permission 指令：无权限时隐藏元素。
 * 用法：
 *   <button v-permission="'button:kuyou_goods:add'">新增</button>
 *   <button v-permission="['button:kuyou_goods:edit','button:kuyou_goods:delete']">编辑/删除</button>
 * 超级管理员（* 通配）始终可见。
 */
export const permissionDirective: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const codes = Array.isArray(binding.value) ? binding.value : [binding.value];
    if (!hasPerm(...codes)) {
      el.style.display = 'none';
    }
  },
  updated(el: HTMLElement, binding: DirectiveBinding) {
    const codes = Array.isArray(binding.value) ? binding.value : [binding.value];
    el.style.display = hasPerm(...codes) ? '' : 'none';
  },
};

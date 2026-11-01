<template>
  <div class="pos">
    <!-- 整页加载态（替代 v-loading 指令） -->
    <div v-if="loading" class="page-loading">加载中…</div>

    <!-- ============ 顶栏：公司名 / 客户选择 / 挂单·源单·结账 ============ -->
    <header class="pos-header">
      <span class="company">{{ init.company_name || '收银台' }}</span>
      <div class="customer-box">
        <DsSelect
          v-model="customerId"
          :options="customerOptions.map((c: any) => ({ label: c.customer_name, value: c.id }))"
          remote
          filterable
          placeholder="请选择客户"
          :loading="customerLoading"
          style="width: 220px"
          @search="searchCustomer"
          @change="onCustomerChange"
        />
        <span v-if="customerName" class="customer-name">{{ customerName }}</span>
      </div>
      <div class="ops">
        <DsButton @click="hanging">F7 挂单</DsButton>
        <DsButton @click="hangVisible = true">F8 源单</DsButton>
        <DsButton variant="primary" @click="checkouts">F9 结账</DsButton>
      </div>
    </header>

    <main class="pos-body">
      <!-- ============ 左：商品网格 ============ -->
      <section class="goods-panel">
        <div class="goods-search">
          <DsInput
            v-model="keyword"
            placeholder="编号 / 名称 / 条码"
            clearable
            @keyup.enter="searchGoods"
            @clear="searchGoods"
          />
          <DsButton variant="primary" @click="searchGoods">搜索</DsButton>
        </div>
        <div class="goods-grid" v-if="goods.length">
          <div v-for="g in goods" :key="g.id" class="goods-card" @click="onGoodsClick(g)">
            <img v-if="g.goods_image" :src="g.goods_image" class="goods-img" alt="" />
            <div v-else class="goods-img no-img">{{ String(g.goods_name || '').slice(0, 2) }}</div>
            <div class="goods-name" :title="g.goods_name">{{ g.goods_name }}</div>
            <div class="goods-price">￥{{ g.market_sell_price }}</div>
            <div class="goods-stock">库存 {{ g.stock }}</div>
          </div>
        </div>
        <DsEmpty v-else title="暂无商品" size="sm" />
        <div class="goods-pager">
          <span class="total-tip">共 {{ total }} 条</span>
          <DsPagination
            layout="prev, pager, next"
            :current-page="page"
            :page-size="limit"
            :total="total"
            @change="onPage"
          />
        </div>
      </section>

      <!-- ============ 右：购物车 ============ -->
      <section class="cart-panel">
        <div class="cart-title">
          购物车
          <DsButton v-if="cart.length" variant="text" size="sm" class="danger-link" @click="cancelGoods">清空</DsButton>
        </div>
        <DsTable :columns="cartCols" :data="cart" striped empty-text="请从左侧选择商品">
          <template #amount="{ row }">{{ (row.number * row.price).toFixed(2) }}</template>
          <template #act="{ row, index }">
            <DsButton variant="text" size="sm" @click="editCartRow(row, index)">改</DsButton>
            <DsButton variant="text" size="sm" class="danger-link" @click="cart.splice(index, 1)">删</DsButton>
          </template>
        </DsTable>
        <div class="cart-foot">
          <span>数量合计：<b>{{ sumNumber }}</b></span>
          <span>金额合计：<b class="money">￥{{ sumMoney.toFixed(2) }}</b></span>
        </div>
      </section>
    </main>

    <!-- ============ 多单位选择（源 showUnit） ============ -->
    <DsModal v-model="unitVisible" :title="unitGoods?.goods_name" :width="320">
      <div v-for="u in unitGoods?.unit_data || []" :key="u.unit" class="pick-row" @click="pickUnit(u)">
        <span>单位：{{ u.name }}（库存 {{ u.stock }}）</span>
        <span class="price">￥{{ u.market_sell_price }}</span>
      </div>
    </DsModal>

    <!-- ============ 多属性选择（源 showAttr：先单位后属性） ============ -->
    <DsModal v-model="attrVisible" :title="attrGoods?.goods_name" :width="400">
      <template v-if="(attrGoods?.unit_data?.length || 0) > 1">
        <div class="pick-sub">请选择单位</div>
        <div v-for="u in attrGoods!.unit_data" :key="'u' + u.unit" class="pick-row" :class="{ active: attrUnit === u.unit }" @click="attrUnit = u.unit">
          <span>单位：{{ u.name }}</span>
          <span class="price">￥{{ u.market_sell_price }}</span>
        </div>
      </template>
      <div class="pick-sub">请选择属性</div>
      <div v-for="a in attrGoods?.attr_data || []" :key="a.id" class="pick-row" @click="pickAttr(a)">
        <span>{{ a.attr_name }}</span>
        <span class="price">￥{{ a.market_sell_price }}</span>
      </div>
    </DsModal>

    <!-- ============ 购物车行参数修改（源 showGoodsInfo） ============ -->
    <DsModal v-model="rowVisible" title="商品参数" :width="340">
      <div class="form-grid">
        <DsField label="商品名称">
          <DsInput :model-value="rowForm.goods_name" disabled />
        </DsField>
        <DsField label="单价">
          <DsInput v-model="rowForm.price" type="number" :min="0" :step="0.01" style="width: 100%" @change="recalcRow" />
        </DsField>
        <DsField label="数量">
          <DsInput v-model="rowForm.number" type="number" :min="0" :step="0.01" style="width: 100%" @change="recalcRow" />
        </DsField>
        <DsField label="总价">
          <DsInput :model-value="(rowForm.price * rowForm.number).toFixed(2)" disabled />
        </DsField>
      </div>
      <template #footer>
        <DsButton @click="rowVisible = false">取消</DsButton>
        <DsButton variant="primary" @click="saveRow">确定</DsButton>
      </template>
    </DsModal>

    <!-- ============ 源单（挂单列表，源 hanged） ============ -->
    <DsModal v-model="hangVisible" title="源单" :width="360">
      <div v-if="!hangList.length" class="hang-empty">暂无源单</div>
      <div v-for="(h, i) in hangList" :key="i" class="hang-row">
        <span class="hang-id" @click="restoreHang(i)">{{ h.id }} - {{ h.time }}</span>
        <span class="hang-cust">{{ h.customers_name }}</span>
        <DsButton variant="text" size="sm" class="danger-link" @click="hangList.splice(i, 1)">删</DsButton>
      </div>
    </DsModal>

    <!-- ============ 结账（源 checkouts 第二段） ============ -->
    <DsModal v-model="payVisible" title="结账" :width="600" :close-on-mask="false">
      <div class="pay-body">
        <div class="pay-left">
          <div class="form-grid">
            <DsField label="单据金额">
              <DsInput :model-value="sumMoney.toFixed(2)" disabled />
            </DsField>
            <DsField label="实际金额">
              <DsInput v-model="payForm.order_money" type="number" :min="0" :step="0.01" style="width: 100%" @change="calcChange" />
            </DsField>
            <DsField label="结算账户">
              <DsSelect
                v-model="payForm.account_id"
                :options="init.accounts.map((a: any) => ({ label: a.account_name, value: a.id }))"
                placeholder="请选择结算账户"
                style="width: 100%"
              />
            </DsField>
            <DsField label="收款金额">
              <DsInput :model-value="payForm.payment" disabled placeholder="请用右侧键盘输入" />
            </DsField>
            <DsField label="找零">
              <span class="change">￥{{ changeMoney.toFixed(2) }}</span>
            </DsField>
            <DsField label="备注">
              <DsInput v-model="payForm.note" />
            </DsField>
          </div>
        </div>
        <div class="pay-right">
          <div class="keypad">
            <button v-for="k in keys" :key="k" class="key" @click="pressKey(k)">{{ k }}</button>
            <button class="key wide" @click="pressKey('back')">退格</button>
            <button class="key wide" @click="pressKey('clear')">清空</button>
          </div>
        </div>
      </div>
      <template #footer>
        <DsButton @click="payVisible = false">取消</DsButton>
        <DsButton variant="primary" :loading="paying" @click="confirmPay">结算</DsButton>
      </template>
    </DsModal>

    <!-- ============ 小票（结账成功，源结账弹层 + doPrint） ============ -->
    <DsModal v-model="receiptVisible" title="结算成功" :width="400" :close-on-mask="false">
      <div id="receipt" class="receipt">
        <div class="r-title">{{ init.company_name }}</div>
        <div class="r-line">单号：{{ receipt.purchase_code }}</div>
        <div class="r-line">日期：{{ receipt.date }}</div>
        <div class="r-line">客户：{{ receipt.cname }}</div>
        <table class="r-table">
          <thead>
            <tr><th>商品</th><th>单价</th><th>数量</th><th>金额</th></tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in receipt.lines" :key="i">
              <td>{{ l.goods_name }}</td>
              <td>{{ l.price }}</td>
              <td>{{ l.number }}</td>
              <td>{{ (l.price * l.number).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="r-line">单据金额：{{ sumMoney.toFixed(2) }}</div>
        <div class="r-line">实际金额：{{ payForm.order_money.toFixed(2) }}</div>
        <div class="r-line">收款金额：{{ payForm.payment.toFixed(2) }}</div>
        <div class="r-line">备注：{{ payForm.note || '—' }}</div>
      </div>
      <template #footer>
        <DsButton variant="primary" @click="printReceipt">打印小票</DsButton>
        <DsButton @click="receiptVisible = false">完成</DsButton>
      </template>
    </DsModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useToast } from '@/components/ds/toast';
import { posInit, posGoods, posCheckout } from '../api/retail';
import { selectpage } from '../api/dynamic';

/* ------------------------------------------------------------------ *
 * 零售收银台（源 retail/goods_sales/retail.html + retail.js + GoodsSales.php）
 * 1) 初始化：公司名 / 结算账户（默认账户选中）/ 小数位
 * 2) 商品网格：关键字搜索 + 分页；多单位 / 多属性商品弹层选择后加入购物车
 * 3) 购物车：改数量 / 改单价 / 删除 / 清空；同（编号+单位+属性）行合并加数量
 * 4) 挂单 F7：当前整单压入内存源单列表并清空购物车；源单 F8：取回或删除
 * 5) 结账 F9：校验客户与商品 → 结算弹窗（实际金额可改价、账户、收款键盘、找零）
 *    → 提交 POS 结算（双单号 + 自动过账）→ 小票展示与打印
 * ------------------------------------------------------------------ */

const toast = useToast();

/** 初始化数据（公司名 / 账户 / 小数位） */
const init = reactive<{ company_name: string; number_decimal: number; price_decimal: number; accounts: any[] }>({
  company_name: '',
  number_decimal: 1,
  price_decimal: 2,
  accounts: [],
});

/* ---------------- 商品网格 ---------------- */
const loading = ref(false);
const keyword = ref('');
const goods = ref<any[]>([]);
const page = ref(1);
const limit = ref(24);
const total = ref(0);

/** 拉取商品网格（客户已选时按等级价返回） */
async function loadGoods() {
  loading.value = true;
  try {
    const res: any = await posGoods({
      keyword: keyword.value || undefined,
      customers_id: customerId.value || undefined,
      page: page.value,
      limit: limit.value,
    });
    const data = res?.data || res || {};
    goods.value = data.list || [];
    total.value = Number(data.count || 0);
  } finally {
    loading.value = false;
  }
}

/** 关键字搜索（回到第一页） */
function searchGoods() {
  page.value = 1;
  loadGoods();
}

/** 翻页 */
function onPage(p: number) {
  page.value = p;
  loadGoods();
}

/* ---------------- 客户选择（源 xmSelect 远程搜索 kuyou/customers/index） ---------------- */
const customerId = ref<number | ''>('');
const customerName = ref('');
const customerOptions = ref<any[]>([]);
const customerLoading = ref(false);

/** 远程搜索客户（编号 / 名称） */
async function searchCustomer(kw: string) {
  customerLoading.value = true;
  try {
    const params: any = { limit: 20, sort: 'id', order: 'DESC' };
    if (kw) {
      params.filter = JSON.stringify({ customer_name: `%${kw}%` });
      params.op = JSON.stringify({ customer_name: 'LIKE' });
    }
    const res: any = await selectpage('kuyou_customers', params);
    customerOptions.value = res?.rows || res?.data?.rows || [];
  } finally {
    customerLoading.value = false;
  }
}

/** 选中客户：记录名称并刷新商品等级价 */
function onCustomerChange(id: number) {
  const hit = customerOptions.value.find((c) => c.id === id);
  customerName.value = hit ? hit.customer_name : '';
  loadGoods();
}

/* ---------------- 购物车 ---------------- */
interface CartRow {
  goods_code: string;
  goods_name: string;
  goods_unit: any;
  goods_attr: any;
  number: number;
  price: number;
}
const cart = ref<CartRow[]>([]);

const sumNumber = computed(() => cart.value.reduce((s, r) => s + Number(r.number || 0), 0));
const sumMoney = computed(() => Number(cart.value.reduce((s, r) => s + Number(r.number || 0) * Number(r.price || 0), 0).toFixed(2)));

/** 购物车列配置 */
const cartCols = [
  { title: '#', key: '__idx', width: '40px', formatter: (_v: any, _r: any, i: number) => i + 1 },
  { title: '商品', key: 'goods_name', minWidth: '100px' },
  { title: '数量', key: 'number', width: '62px' },
  { title: '金额', key: 'amount', width: '72px', slot: true },
  { title: '操作', key: 'act', width: '72px', slot: true },
];

/** 多单位弹层 */
const unitVisible = ref(false);
const unitGoods = ref<any>(null);

/** 多属性弹层（先选单位后选属性，单位多于一个时展示） */
const attrVisible = ref(false);
const attrGoods = ref<any>(null);
const attrUnit = ref<any>('');

/**
 * 商品点击（源 goods_info onclick 分发）
 * 多单位 → 单位弹层；否则多属性 → 属性弹层；否则直接按主单位整价入车。
 */
function onGoodsClick(g: any) {
  if ((g.unit_data || []).length > 1) {
    unitGoods.value = g;
    unitVisible.value = true;
  } else if ((g.attr_data || []).length > 1) {
    attrGoods.value = g;
    attrUnit.value = g.unit_id;
    attrVisible.value = true;
  } else {
    addGoods(g, g.unit_data?.[0] || { unit: g.unit_id, market_sell_price: g.market_sell_price });
  }
}

/** 选择单位入车 */
function pickUnit(u: any) {
  if (unitGoods.value) addGoods(unitGoods.value, u);
  unitVisible.value = false;
}

/** 选择属性入车（单价取所选单位的属性价） */
function pickAttr(a: any) {
  if (!attrGoods.value) return;
  const unit = attrGoods.value.unit_data?.find((u: any) => u.unit === attrUnit.value) || attrGoods.value.unit_data?.[0];
  addGoods(attrGoods.value, unit, a);
  attrVisible.value = false;
}

/**
 * 加入购物车（源 addGoods）
 * 同一（编号 + 单位 + 属性）已存在则数量 +1，否则新开一行。
 * @param g 商品网格行
 * @param u 所选单位行 { unit, market_sell_price, name }
 * @param a 所选属性行（可选）{ id, attr_name, market_sell_price }
 */
function addGoods(g: any, u: any, a?: any) {
  const price = a ? a.market_sell_price : u.market_sell_price;
  const key = { goods_code: g.goods_code, goods_unit: u.unit, goods_attr: a ? a.id : '' };
  const hit = cart.value.find(
    (r) => r.goods_code === key.goods_code && String(r.goods_unit) === String(key.goods_unit) && String(r.goods_attr) === String(key.goods_attr),
  );
  if (hit) {
    hit.number = Number((hit.number + 1).toFixed(2));
    return;
  }
  let name = g.goods_name;
  if (a) name += `_${a.attr_name}`;
  cart.value.push({
    goods_code: key.goods_code,
    goods_name: name,
    goods_unit: key.goods_unit,
    goods_attr: key.goods_attr,
    number: 1,
    price: Number(price || 0),
  });
}

/** 清空购物车（源 cancelGoods） */
function cancelGoods() {
  cart.value = [];
}

/* ---------------- 购物车行参数修改 ---------------- */
const rowVisible = ref(false);
const rowIndex = ref(-1);
const rowForm = ref<CartRow>({ goods_code: '', goods_name: '', goods_unit: '', goods_attr: '', number: 1, price: 0 });

/** 打开行参数修改（源 showGoodsInfo） */
function editCartRow(row: CartRow, i: number) {
  rowForm.value = { ...row };
  rowIndex.value = i;
  rowVisible.value = true;
}

/** 单价 / 数量变更即时算总价 */
function recalcRow() {
  /* 总价由模板实时计算，这里仅做精度规整 */
  rowForm.value.price = Number(rowForm.value.price || 0);
  rowForm.value.number = Number(rowForm.value.number || 0);
}

/** 保存行参数（数量改 ≤0 视为删除该行） */
function saveRow() {
  if (rowIndex.value >= 0) {
    if (Number(rowForm.value.number) <= 0) {
      cart.value.splice(rowIndex.value, 1);
    } else {
      cart.value[rowIndex.value] = { ...rowForm.value };
    }
  }
  rowVisible.value = false;
}

/* ---------------- 挂单 / 源单（内存，源 hanging / hanged） ---------------- */
interface HangRow {
  id: string;
  time: string;
  customers_id: any;
  customers_name: string;
  goods: CartRow[];
}
const hangList = ref<HangRow[]>([]);
const hangVisible = ref(false);

/** 挂单：校验客户与商品后压入源单列表并清空购物车（源 hanging） */
function hanging() {
  if (!customerId.value) {
    toast.error('请选择客户');
    return;
  }
  if (!cart.value.length) {
    toast.error('请选择商品数据');
    return;
  }
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  hangList.value.push({
    id: `NO.${hangList.value.length + 1}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    customers_id: customerId.value,
    customers_name: customerName.value,
    goods: cart.value.map((r) => ({ ...r })),
  });
  cart.value = [];
  toast.success('已挂单');
}

/** 取回源单：还原购物车与客户，并从列表移除（源 addyuan） */
function restoreHang(i: number) {
  const h = hangList.value[i];
  if (!h) return;
  cart.value = h.goods.map((r) => ({ ...r }));
  customerId.value = h.customers_id;
  customerName.value = h.customers_name;
  hangList.value.splice(i, 1);
  hangVisible.value = false;
  loadGoods();
}

/* ---------------- 结账 ---------------- */
const payVisible = ref(false);
const paying = ref(false);
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];
const payForm = reactive({ order_money: 0, payment: 0, account_id: '' as any, note: '' });

/** 找零 = 收款金额 − 实际金额（源 changeMoney） */
const changeMoney = computed(() => Number((payForm.payment - payForm.order_money).toFixed(2)));

/** 打开结算弹窗（源 checkouts 第一段：默认实际金额=购物车合计） */
function checkouts() {
  if (!customerId.value) {
    toast.error('请选择客户');
    return;
  }
  if (!cart.value.length) {
    toast.error('请选择商品数据');
    return;
  }
  payForm.order_money = sumMoney.value;
  payForm.payment = 0;
  payForm.note = '';
  const def = init.accounts.find((a) => Number(a.is_default) === 1) || init.accounts[0];
  payForm.account_id = def ? def.id : '';
  payVisible.value = true;
}

/** 收款键盘输入（源 btn_jsq / btn_j / btn_d） */
function pressKey(k: string) {
  if (k === 'back') {
    payForm.payment = Number(String(payForm.payment).slice(0, -1)) || 0;
  } else if (k === 'clear') {
    payForm.payment = 0;
  } else {
    payForm.payment = Number(String(payForm.payment) + k) || 0;
  }
}

/** 实际金额变更重算找零 */
function calcChange() {
  payForm.order_money = Number(payForm.order_money || 0);
}

/* ---------------- 小票 ---------------- */
const receiptVisible = ref(false);
const receipt = reactive<{ purchase_code: string; date: string; cname: string; lines: any[] }>({
  purchase_code: '',
  date: '',
  cname: '',
  lines: [],
});

/**
 * 提交结算（源 checkouts 第二段 ajax）
 * 校验收款金额不小于购物车合计 → 调 POS 结算接口 → 展示小票。
 */
async function confirmPay() {
  if (!payForm.account_id) {
    toast.warning('请选择结算账户');
    return;
  }
  if (!payForm.payment) {
    toast.warning('请输入收款金额');
    return;
  }
  if (payForm.payment < sumMoney.value) {
    toast.warning('实际收金额小于应收金额');
    return;
  }
  paying.value = true;
  try {
    // 商品行按后端要求序列化（编号/单位/属性/数量/单价）
    const goodsList = cart.value.map((r) => ({
      goods_code: r.goods_code,
      goods_unit: r.goods_unit,
      goods_attr: r.goods_attr,
      number: r.number,
      price: r.price,
    }));
    const res: any = await posCheckout({
      customers_id: Number(customerId.value),
      account_id: Number(payForm.account_id),
      all_money: payForm.payment,
      note: payForm.note,
      goods_list: JSON.stringify(goodsList),
    });
    const data = res?.data || res || {};
    receipt.purchase_code = data.purchase_code || '';
    receipt.date = data.date || '';
    receipt.cname = data.cname || '';
    receipt.lines = cart.value.map((r) => ({ ...r }));
    cart.value = [];
    payVisible.value = false;
    receiptVisible.value = true;
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '结算失败');
  } finally {
    paying.value = false;
  }
}

/** 小票打印（源 doPrint：隐藏 iframe 写入小票内容后调起打印） */
function printReceipt() {
  const obj = document.getElementById('receipt');
  if (!obj) return;
  const iframe = document.createElement('IFRAME') as HTMLIFrameElement;
  iframe.setAttribute('style', 'width:0px;height:0px;position:absolute;left:-2000px;top:-2000px;');
  iframe.setAttribute('align', 'left');
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.write('<div style="width:100%;min-width:320px;margin:0 auto;" align="left">' + obj.innerHTML + '</div>');
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }
  document.body.removeChild(iframe);
}

/* ---------------- 键盘快捷键（源 keyUp：F7/F8/F9/F10/Esc） ---------------- */
function onKeyup(e: KeyboardEvent) {
  // 弹窗打开时不响应挂单/源单/结账快捷键
  if (payVisible.value || receiptVisible.value || rowVisible.value || unitVisible.value || attrVisible.value || hangVisible.value) return;
  switch (e.keyCode) {
    case 118: // F7 挂单
      hanging();
      break;
    case 119: // F8 源单
      hangVisible.value = true;
      break;
    case 120: // F9 结账
      checkouts();
      break;
    case 121: // F10 打印小票（仅小票展示时有效）
      if (receiptVisible.value) printReceipt();
      break;
    default:
      break;
  }
}

onMounted(async () => {
  document.addEventListener('keyup', onKeyup);
  const res: any = await posInit();
  const data = res?.data || res || {};
  init.company_name = data.company_name || '';
  init.number_decimal = Number(data.number_decimal || 1);
  init.price_decimal = Number(data.price_decimal || 2);
  init.accounts = data.accounts || [];
  await searchCustomer('');
  await loadGoods();
});

onBeforeUnmount(() => {
  document.removeEventListener('keyup', onKeyup);
});
</script>

<style scoped>
.pos {
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 110px);
  background: var(--ds-bg);
}
/* 整页加载态 */
.page-loading {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ds-frosted);
  color: var(--ds-text-2);
  font-size: 14px;
}
/* 顶栏 */
.pos-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--ds-brand);
  color: #fff;
  border-radius: var(--ds-radius-sm) var(--ds-radius-sm) 0 0;
}
.pos-header .company {
  font-size: 16px;
  font-weight: 600;
}
.customer-box {
  display: flex;
  align-items: center;
  gap: 8px;
}
.customer-name {
  font-size: 13px;
  opacity: 0.9;
}
.pos-header .ops {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
/* 主体 */
.pos-body {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 10px;
  min-height: 0;
}
.goods-panel {
  flex: 1.6;
  display: flex;
  flex-direction: column;
  background: var(--ds-bg-elevated);
  border-radius: var(--ds-radius-sm);
  padding: 10px;
  min-width: 0;
}
.goods-search {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.goods-search .ds-input {
  flex: 1;
}
.goods-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
  align-content: start;
}
.goods-card {
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-sm);
  padding: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}
.goods-card:hover {
  border-color: var(--ds-brand);
  box-shadow: 0 2px 8px var(--ds-brand-soft);
}
.goods-img {
  width: 100%;
  height: 72px;
  object-fit: contain;
  border-radius: var(--ds-radius-sm);
}
.goods-img.no-img {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ds-bg-soft);
  color: var(--ds-text-3);
  font-size: 20px;
  font-weight: 600;
}
.goods-name {
  margin-top: 6px;
  font-size: 13px;
  color: var(--ds-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.goods-price {
  color: var(--ds-danger);
  font-weight: 600;
  font-size: 14px;
}
.goods-stock {
  color: var(--ds-text-3);
  font-size: 12px;
}
.goods-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}
.total-tip {
  color: var(--ds-text-3);
  font-size: 12px;
}
/* 购物车 */
.cart-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--ds-bg-elevated);
  border-radius: var(--ds-radius-sm);
  padding: 10px;
  min-width: 360px;
}
.cart-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 8px;
}
.cart-table {
  flex: 1;
  min-height: 0;
}
.cart-foot {
  display: flex;
  justify-content: space-between;
  padding-top: 10px;
  font-size: 14px;
}
.cart-foot .money {
  color: var(--ds-danger);
  font-size: 16px;
}
/* 弹层选择行 */
.pick-sub {
  font-size: 13px;
  color: var(--ds-text-3);
  margin: 6px 0;
}
.pick-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-sm);
  margin-bottom: 6px;
  cursor: pointer;
}
.pick-row:hover,
.pick-row.active {
  border-color: var(--ds-brand);
  background: var(--ds-brand-soft);
}
.pick-row .price {
  color: var(--ds-danger);
  font-weight: 600;
}
/* 源单 */
.hang-empty {
  text-align: center;
  color: var(--ds-text-3);
  padding: 20px 0;
}
.hang-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--ds-divider);
}
.hang-id {
  color: var(--ds-brand);
  cursor: pointer;
}
.hang-cust {
  color: var(--ds-text-2);
  font-size: 13px;
  margin-left: auto;
}
/* 结账 */
.pay-body {
  display: flex;
  gap: 16px;
}
.pay-left {
  flex: 1.2;
}
.pay-right {
  flex: 1;
}
/* 弹窗表单栅格由全局 form.css 提供 */
.change {
  color: var(--ds-danger);
  font-weight: 600;
  font-size: 16px;
}
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.keypad .key {
  height: 48px;
  font-size: 18px;
  border: 1px solid var(--ds-border-strong);
  border-radius: var(--ds-radius-sm);
  background: var(--ds-bg-elevated);
  color: var(--ds-text);
  cursor: pointer;
}
.keypad .key:hover {
  background: var(--ds-brand-soft);
  border-color: var(--ds-brand);
}
.keypad .key.wide {
  grid-column: span 3;
  height: 36px;
  font-size: 14px;
}
/* 小票 */
.receipt {
  font-size: 13px;
  color: var(--ds-text);
}
.r-title {
  text-align: center;
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 8px;
}
.r-line {
  line-height: 22px;
}
.r-table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
}
.r-table th,
.r-table td {
  border: 1px solid var(--ds-border-strong);
  padding: 4px 6px;
  text-align: center;
}
.danger-link { color: var(--ds-danger); }
</style>

<script setup>
/**
 * 할 일 카드 목록(App에서 날짜 필터링된 배열만 받음)
 * 클릭 → 상세/수정 모달, 체크박스 → 완료 토글
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['select', 'toggle-complete', 'edit', 'delete'])

const openDropdownId = ref(null)

function toggleItemMenu(itemId) {
  openDropdownId.value = openDropdownId.value === itemId ? null : itemId
}

function onDocumentClickCloseDropdown(e) {
  if (openDropdownId.value == null) return
  const target = e.target
  if (!(target instanceof Element)) return
  if (target.closest('.listOptWrap')) return
  openDropdownId.value = null
}

onMounted(() => {
  document.addEventListener('click', onDocumentClickCloseDropdown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClickCloseDropdown)
})

function onEdit(item) {
  openDropdownId.value = null
  emit('edit', item)
}

function onDelete(item) {
  openDropdownId.value = null
  emit('delete', item)
}

/** 기간 문자열: 하루 일정은 단일 날짜, 다일 일정은 구간으로 표시 */
function periodLine(item) {
  const s = item.startDate
  const e = item.endDate ?? s
  if (!s || !e) return ''
  if (s === e) return s
  return `${s} ~ ${e}`
}

const rows = computed(() =>
  props.items.map((item) => ({
    item,
    period: periodLine(item),
  })),
)
</script>
<template>
  <!-- 항목 있음 -->
  <ul v-if="rows.length" class="listWrap">
    <li
      v-for="{ item, period } in rows"
      :key="item.id"
      :class="{ 'is-completed': item.completed }"
    >
      <div class="listInfo">
        <input
          type="checkbox"
          :name="'chk-' + item.id"
          :id="'chk-' + item.id"
          :checked="item.completed"
          @change="emit('toggle-complete', { id: item.id, completed: $event.target.checked })"
        >
        <div class="textWrap">
          <p class="list" @click="emit('select', item)">
            {{ item.title }}
          </p>
          <p class="memo">{{ item.memo }}</p>
          <div class="textInfo">
            <p class="priority"><span class="tag" :class="`tag-${item.priority}`">{{ item.priorityLabel }}</span></p>
            <p v-if="period" class="period">{{ period }}</p>
          </div>
        </div>
      </div>
      <div class="listOptWrap">
        <button
          type="button"
          class="listOpt"
          aria-label="옵션"
          @click.stop="toggleItemMenu(item.id)"
        >
          <svg class="icon" viewBox="0 0 2 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 9C0 9.55228 0.447715 10 1 10C1.55228 10 2 9.55228 2 9C2 8.44772 1.55228 8 1 8C0.447715 8 0 8.44772 0 9Z" fill="currentColor"/>
            <path d="M0 5C0 5.55228 0.447715 6 1 6C1.55228 6 2 5.55228 2 5C2 4.44772 1.55228 4 1 4C0.447715 4 0 4.44772 0 5Z" fill="currentColor"/>
            <path d="M0 1C0 1.55228 0.447715 2 1 2C1.55228 2 2 1.55228 2 1C2 0.447715 1.55228 0 1 0C0.447715 0 0 0.447715 0 1Z" fill="currentColor"/>
          </svg>

        </button>
        <div v-if="openDropdownId === item.id" class="listDropdown">
          <button type="button" class="dropdownItem" @click.stop="onEdit(item)">수정</button>
          <button type="button" class="dropdownItem is-danger" @click.stop="onDelete(item)">삭제</button>
        </div>
      </div>
    </li>
  </ul>
  <!-- 필터 결과 비었을 때 -->
  <p v-else class="listEmpty">등록된 일정이 없습니다.</p>
</template>
<style scoped>
  .listEmpty {
    margin: 0;
    padding: 2rem 1rem;
    text-align: center;
    font-size: 1.4rem;
    color: var(--color-gray-500);
    border: 1px solid var(--color-border);
  }
  .listWrap li{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap:1rem;
    padding:1rem;
    border:1px solid var(--color-border);
    border-bottom:none;
  }
  .listWrap li:last-child{
    border-bottom:1px solid var(--color-border);
  }
  .listWrap li.is-completed{
    background: var(--color-gray-100);
  }
  .listWrap .listInfo{
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    gap:0.8rem;
  }
  .listWrap li input[type="checkbox"]{
    margin:0.9rem 0 0;
  }
  .textWrap .list{
    font-weight:700;
    line-height: 1.4;
    margin:0.8rem 0;
    cursor: pointer;
  }
  .textWrap .list:hover{
    text-decoration: underline;
    color:var(--color-point);
  }

  .textWrap .memo {
    font-size:1.2rem;
    color:var(--color-gray-500);
    white-space: pre-wrap;
    line-height:1.4;
  }
  .textWrap .textInfo{
    margin-top:2rem;
  }

  .textWrap .textInfo p:not(:last-child):after{
    content:'';
    display: inline-block;
    width: 1px;
    height:1rem;
    margin:0 0.8rem;
    background:var(--color-gray-400);
  }

  .textWrap .priority{
    display: inline;
  }
  .textWrap .priority .tag{
    display: inline-block;
    padding:0.2rem 0.6rem 0.1rem;
    border-radius: 0.2rem;
    font-size:1.1rem;
    font-weight:700;
  }

  .textWrap .priority .tag.tag-1{
    background:var(--priority-urgent-bg);
    color:var(--priority-urgent);
  }
  .textWrap .priority .tag.tag-2{
    background:var(--priority-high-bg);
    color:var(--priority-high);
  }
  .textWrap .priority .tag.tag-3{
    background:var(--priority-normal-bg);
    color:var(--priority-normal);
  }
  .textWrap .priority .tag.tag-4{
    background:var(--priority-low-bg);
    color:var(--priority-low);
  }
  .textWrap .period {
    display: inline;
    font-size: 1.2rem;
    color: var(--color-gray-500);
    line-height: 1.3;
  }

  .listWrap li.is-completed .textWrap .list {
    color: var(--color-gray-500);
    text-decoration: line-through;
  }
  .listWrap li.is-completed .textWrap .list:hover {
    color: var(--color-gray-700);
    text-decoration: line-through;
  }

  .listOptWrap {
    position: relative;
    flex: none;
  }

  .listWrap li .listOpt {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: none;
    width: 3rem;
    height: 3rem;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .listWrap li .listOpt .icon {
    flex-shrink: 0;
    width: 0.3rem;
    height: 1.5rem;
    color: var(--color-gray-500);
  }

  .listDropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 0.4rem);
    width: 10rem;
    background: var(--color-white);
    border: 0.1rem solid var(--color-border);
    border-radius: 0.4rem;
    overflow: hidden;
    z-index: 10;
    box-shadow: 0 0.2rem 0.8rem rgba(0, 0, 0, 0.08);
  }

  .dropdownItem {
    width: 100%;
    min-height: 3.4rem;
    border: none;
    border-bottom: 0.1rem solid var(--color-border);
    background: var(--color-white);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--color-gray-700);
    cursor: pointer;
  }

  .dropdownItem:last-child {
    border-bottom: none;
  }

  .dropdownItem.is-danger {
    color: var(--priority-urgent);
  }

  .dropdownItem:hover {
    background: var(--color-gray-100);
  }
</style>

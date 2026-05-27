<script setup>
/**
 * emoji-mart Picker를 Vue에서 쓰기 위한 래퍼 (Web Component 마운트)
 * - body Teleport + fixed 위치로 모달 overflow에 잘리지 않게 함
 */
import data from '@emoji-mart/data'
import i18nKo from '@emoji-mart/data/i18n/ko.json'
import { Picker } from 'emoji-mart'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  /** getBoundingClientRect 기준 앵커 (보통 이모지 버튼 ref) */
  anchor: {
    type: Object,
    default: null,
  },
  /** true면 피커 상단에 「제거」 버튼 표시 */
  canRemove: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'remove', 'close'])

const hostRef = ref(null)
const popoverStyle = ref({})

let pickerEl = null

/* emoji-mart 피커·팝업 카드 크기 */
const PICKER_WIDTH = 288            // 이미지picker 가로(px)
const PICKER_HEIGHT_PX = 300        //이미지picker 세로(px)
const PICKER_PER_LINE = 8           // 1줄에 표시할 이모지 갯수
const PICKER_EMOJI_BUTTON_SIZE = 32 // 이모지 1칸 크기(px)
const PICKER_EMOJI_SIZE = 20        // 이모지 크기(px)

function updatePosition() {
  const el = props.anchor
  if (!el?.getBoundingClientRect) return
  const rect = el.getBoundingClientRect()
  // 입력 줄(.inputTit) 우측 끝에 팝업 우측 정렬
  let left = rect.right - PICKER_WIDTH
  left = Math.max(8, Math.min(left, window.innerWidth - PICKER_WIDTH - 8))
  popoverStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    left: `${left}px`,
    width: `${PICKER_WIDTH}px`,
    zIndex: 10000,
  }
}

function destroyPicker() {
  pickerEl?.remove?.()
  pickerEl = null
}

async function mountPicker() {
  destroyPicker()
  await nextTick()
  pickerEl = new Picker({
    data,                                       // 이모지 데이터
    i18n: i18nKo,                               // 한국어 라벨
    locale: 'ko',
    theme: 'auto',
    navPosition: 'bottom',
    previewPosition: 'none',                    // 미리보기 숨김
    searchPosition: 'sticky',
    perLine: PICKER_PER_LINE,                   // 1줄에 보이는 이모지(8개)
    emojiButtonSize: PICKER_EMOJI_BUTTON_SIZE,  // 이모지 칸 크기
    emojiSize: PICKER_EMOJI_SIZE,               // 칸 안의 이모지 크기
    maxFrequentRows: 2,
    onEmojiSelect: (emoji) => {                 //선택 시
      emit('select', emoji)
      emit('close')
    },
    onClickOutside: () => emit('close'), // 바깥 클릭 시 닫기
  })
  pickerEl.style.width = '100%'
  pickerEl.style.height = `${PICKER_HEIGHT_PX}px`
  pickerEl.style.maxHeight = `min(${PICKER_HEIGHT_PX}px, 55vh)`
  pickerEl.style.boxShadow = 'none'
  pickerEl.style.setProperty('--shadow', 'none')
  pickerEl.style.setProperty('--border-radius', '0')
  pickerEl.style.setProperty('--font-size', '1.4rem')
  hostRef.value?.appendChild(pickerEl)
}

function onWindowChange() {
  if (props.open) updatePosition()
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      updatePosition()
      await mountPicker()
      window.addEventListener('resize', onWindowChange)
      window.addEventListener('scroll', onWindowChange, true)
    } else {
      destroyPicker()
      window.removeEventListener('resize', onWindowChange)
      window.removeEventListener('scroll', onWindowChange, true)
    }
  },
)

onBeforeUnmount(() => {
  destroyPicker()
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="emoji-picker-popover" :style="popoverStyle">
      <div v-if="canRemove" class="emoji-picker-toolbar">
        <button type="button" class="emoji-picker-remove" @click="emit('remove')">
          이모지 제거
        </button>
      </div>
      <div ref="hostRef" class="emoji-picker-host" />
    </div>
  </Teleport>
</template>

<style scoped>
.emoji-picker-popover {
  box-sizing: border-box;
  overflow: visible;
  background: var(--color-white, #fff);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 1rem;
  box-shadow:
    0 0.4rem 1.6rem rgba(0, 0, 0, 0.12),
    0 0.2rem 0.6rem rgba(0, 0, 0, 0.06);
}

.emoji-picker-toolbar {
  display: flex;
  justify-content: flex-end;
  background: var(--color-white, #fff);
  border-bottom: 1px solid var(--color-border, #e8e8e8);
  border-radius: 1rem 1rem 0 0;
}

.emoji-picker-remove {
  border: none;
  background: transparent;
  font-size: 1.3rem;
  color: var(--color-gray-500, #888);
  cursor: pointer;
  padding: 1rem 0.8rem;
}

.emoji-picker-remove:hover {
  color: var(--color-point, #007bed);
}

.emoji-picker-host {
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 0 0 1rem 1rem;
}

.emoji-picker-popover:not(:has(.emoji-picker-toolbar)) .emoji-picker-host {
  border-radius: 1rem;
}
</style>

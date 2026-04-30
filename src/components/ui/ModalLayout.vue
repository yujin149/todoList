<script setup>
/**
 * 공통 모달 뼈대
 * - v-model:open 으로 표시 여부 제어
 * - 슬롯: title(헤더), default(본문), footer(하단 버튼)
 */
const open = defineModel('open', { type: Boolean, default: false })
</script>

<template>
  <!-- 반투명 배경 + 중앙 패널 -->
  <div v-show="open" class="modalWrap">
    <div class="modalInner">
      <!-- 스티키 헤더 -->
      <div class="modalTitle">
        <h2>
          <slot name="title">제목</slot>
        </h2>
        <button type="button" class="closeBtn" @click="open = false">
          <svg
            class="closeIcon"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 13L7.00002 7.00002M7.00002 7.00002L1 1M7.00002 7.00002L13 1M7.00002 7.00002L1 13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          닫기
        </button>
      </div>
      <div class="modalCont">
        <slot>컨텐츠 영역</slot>
      </div>
      <!-- 스티키 푸터 -->
      <div class="modalBtn">
        <slot name="footer">버튼 영역</slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modalWrap {
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-opacity60);
  z-index: 99;
}

.modalInner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-white);
  border-radius: 2rem;
  z-index: 999;
  width: 98%;
  max-width: 44rem;
  max-height:85vh;
  overflow-y: auto;
}
.modalInner::-webkit-scrollbar { 
  width: 1.6rem; 
}
.modalInner::-webkit-scrollbar-thumb { 
  background:var(--bg-opacity40); 
  border-radius: 999rem; 
  border: 0.4rem solid transparent; 
  background-clip: content-box;
  position:relative;
}
.modalInner::-webkit-scrollbar-track { 
  background:var(--color-gray-100);
}

.modalTitle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 0 2rem;
  height: 6rem;
  position:sticky;
  top:0;
  background:var(--color-white);
  border-bottom:1px solid var(--color-border);
}

.modalTitle h2 {
  font-size: 2rem;
  font-weight: 700;
}

.modalTitle .closeBtn {
  font-size: 0;
  letter-spacing: -9999px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding:0;
  height:100%;
  padding: 0 2rem;
  outline-offset: -3px;
}

.closeIcon {
  color: var(--color-gray-900);
  width: 1.6rem;
  height: 1.6rem;
}

.modalCont {
  padding:1rem 2rem 2rem;
}

.modalBtn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding:1.5rem 2rem;
  line-height:1;
  width:100%;
  position:sticky;
  left:0;
  bottom:0;
  background:var(--color-white);
  z-index: 99;
  border-top:1px solid var(--color-border);
}

.modalBtn :deep(.commBtn) {
  width: 100%;
  height: 4.6rem;
}

.modalBtn :deep(.addBtn) {
  background: var(--color-point);
  color: var(--color-white);
}

.modalBtn :deep(.closeBtn) {
  border: 0.1rem solid var(--color-border);
  color: var(--color-gray-700);
}
</style>

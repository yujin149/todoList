<script setup>
import { computed } from 'vue'
import { REPEAT_SCOPE_DELETE, REPEAT_SCOPE_UPDATE } from '../../utils/repeatMapper'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  /** update: 저장 범위 / delete: 삭제 범위 */
  mode: {
    type: String,
    default: 'update',
    validator: (v) => ['update', 'delete'].includes(v),
  },
})

const emit = defineEmits(['confirm', 'cancel'])

const title = computed(() => (props.mode === 'delete' ? '이 일정을 삭제할까요?' : '저장'))

const options = computed(() =>
  props.mode === 'delete' ? REPEAT_SCOPE_DELETE : REPEAT_SCOPE_UPDATE,
)

function select(value) {
  emit('confirm', value)
  open.value = false
}

function cancel() {
  emit('cancel')
  open.value = false
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="scope-overlay" @click.self="cancel">
      <div class="scope-panel" role="dialog" aria-modal="true" :aria-label="title">
        <p class="scope-title">{{ title }}</p>
        <ul class="scope-list">
          <li v-for="opt in options" :key="opt.value">
            <button
              type="button"
              class="scope-option"
              :class="{ 'is-danger': opt.danger }"
              @click="select(opt.value)"
            >
              {{ opt.label }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.scope-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--bg-opacity60);
}

.scope-panel {
  width: 98%;
  max-width: 42rem;
  padding: 2rem;
  border-radius: 2rem;
  background: var(--color-white);
}

.scope-title {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-gray-900);
  line-height: 1.4;
}

.scope-desc {
  margin: 0.5rem 0 0;
  font-size: 1.3rem;
  line-height: 1.5;
  color: var(--color-gray-500);
}

.scope-list {
  list-style: none;
  margin: 2rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.scope-list li{
  width:100%;
}

.scope-option {
  padding: 0;
  font-size: 1.4rem;
  font-weight: 500;
  letter-spacing: -0.02rem;
  color: var(--color-gray-700);
  cursor: pointer;
  text-align: center;
  width: 100%;
  height: 4rem;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 4rem;
  background: var(--color-gray-100);
}
.scope-option.is-danger {
  color: var(--priority-urgent);
}

.scope-option:hover {
  background:var(--color-point);
  color:var(--color-white);
}

</style>

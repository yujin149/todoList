/** 일정 제목 + 이모지 표시 문자열 (캘린더 막대 등) */
export function formatScheduleLabel(item) {
  const title = (item?.title && String(item.title).trim()) || '일정'
  const emoji = item?.emoji && String(item.emoji).trim()
  return emoji ? `${emoji}${title}` : title
}

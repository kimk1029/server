/**
 * 6자리 방 코드 생성 (알파벳 대문자 + 숫자)
 */
export const generateRoomId = (existingIds: Set<string>): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  
  do {
    id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (existingIds.has(id));
  
  return id;
};

/**
 * 랜덤 메시지 ID 생성
 */
export const generateMessageId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

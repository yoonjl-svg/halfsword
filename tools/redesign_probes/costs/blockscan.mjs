process.argv[2] = 'none';
// 인계받은 파일이 여기서 끊겨 있다(두 줄뿐) — 측정 본문은 없다. 경로만 저장소 루트로 고쳐 둔다.
const SNAP = new URL('../../../', import.meta.url); // 저장소 루트

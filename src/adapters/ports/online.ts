export type OnlineState = "online" | "offline";
export type OnlineStatusListener = (state: OnlineState) => void;

export interface OnlineStatusPort {
  current(): OnlineState;
  subscribe(listener: OnlineStatusListener): () => void;
}

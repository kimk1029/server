import { WebRTCSignalingService } from '../services/WebRTCSignalingService';

export const handleWebRTCSignal = (
  roomId: string,
  playerId: string,
  payload: any,
  webrtcService: WebRTCSignalingService
) => {
  webrtcService.relaySignal(roomId, playerId, payload);
};

export const handlePTTRequest = (
  roomId: string,
  playerId: string,
  webrtcService: WebRTCSignalingService
) => {
  webrtcService.requestPTT(roomId, playerId);
};

export const handlePTTRelease = (
  roomId: string,
  playerId: string,
  webrtcService: WebRTCSignalingService
) => {
  webrtcService.releasePTT(roomId, playerId);
};

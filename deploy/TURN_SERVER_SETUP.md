# TURN 서버 설치 가이드

이 가이드는 Node.js 서버와 같은 머신에 **Coturn TURN 서버**를 설치하고 설정하는 방법을 설명합니다.

## 📋 개요

**TURN 서버**는 WebRTC P2P 연결이 실패할 때 중계(relay) 역할을 합니다. 특히:
- 서로 다른 네트워크 (와이파이 ↔ LTE)
- 엄격한 NAT/방화벽 환경
- 기업망/공공 와이파이

이런 경우에 **필수적**입니다.

---

## 🚀 빠른 설치 (자동 스크립트)

```bash
cd /kh_dev/server/deploy
chmod +x setup-turn-server.sh
sudo ./setup-turn-server.sh
```

스크립트가 자동으로:
1. Coturn 설치
2. 설정 파일 생성
3. 서비스 활성화
4. 방화벽 포트 열기
5. TURN 서버 정보 출력

---

## 📝 수동 설치

### 1. Coturn 설치

```bash
sudo apt-get update
sudo apt-get install -y coturn
```

### 2. 설정 파일 생성

```bash
sudo nano /etc/turnserver.conf
```

다음 내용 추가:

```ini
# 리스닝 포트
listening-port=3478
tls-listening-port=5349

# ⚠️ 중요: 서버의 공인 IP로 변경
external-ip=YOUR_PUBLIC_IP

# 릴레이 IP 범위
relay-ip=127.0.0.1
relay-ip=10.0.0.0/8
relay-ip=172.16.0.0/12
relay-ip=192.168.0.0/16

# 사용자 인증 (비밀번호는 안전하게 생성)
user=pnt_turn_user:YOUR_SECURE_PASSWORD

# 로그
log-file=/var/log/turnserver.log
verbose

# 보안
no-cli
no-tls
no-dtls
no-stdout-log

# Realm
realm=pnt-turn-server

# 성능
max-bps=1000000
total-quota=100
user-quota=12

# ICE 지원
fingerprint
lt-cred-mech
```

### 3. 공인 IP 확인 및 설정

```bash
# 공인 IP 확인
curl ifconfig.me
# 또는
curl ipinfo.io/ip

# 설정 파일에서 external-ip 수정
sudo nano /etc/turnserver.conf
# external-ip=YOUR_PUBLIC_IP
```

### 4. Coturn 서비스 시작

```bash
# 서비스 활성화
sudo systemctl enable coturn
sudo systemctl start coturn

# 상태 확인
sudo systemctl status coturn
```

### 5. 방화벽 포트 열기

```bash
# UFW 사용 시
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 49152:65535/udp  # RTP/RTCP 포트 범위

# iptables 사용 시
sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT
```

---

## ✅ 설치 확인

### 1. 서비스 상태 확인

```bash
sudo systemctl status coturn
```

### 2. 포트 리스닝 확인

```bash
sudo netstat -tulpn | grep 3478
# 또는
sudo ss -tulpn | grep 3478
```

### 3. 로그 확인

```bash
sudo tail -f /var/log/turnserver.log
```

---

## 🔧 클라이언트 앱 설정

TURN 서버 정보를 클라이언트 앱에 설정해야 합니다.

### Android

`android/gradle.properties` 또는 빌드 시:

```properties
PNT_TURN_URL=turn:YOUR_PUBLIC_IP:3478
PNT_TURN_USERNAME=pnt_turn_user
PNT_TURN_CREDENTIAL=YOUR_SECURE_PASSWORD
```

또는 빌드 시:

```bash
./gradlew assembleDebug \
  -PPNT_TURN_URL="turn:YOUR_PUBLIC_IP:3478" \
  -PPNT_TURN_USERNAME="pnt_turn_user" \
  -PPNT_TURN_CREDENTIAL="YOUR_SECURE_PASSWORD"
```

### iOS

`Info.plist` 또는 Xcode Build Settings:

```
PNT_TURN_URL: turn:YOUR_PUBLIC_IP:3478
PNT_TURN_USERNAME: pnt_turn_user
PNT_TURN_CREDENTIAL: YOUR_SECURE_PASSWORD
```

---

## 🧪 테스트

### 1. TURN 서버 연결 테스트

온라인 도구 사용:
- https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
- TURN URL 입력 후 테스트

### 2. 앱에서 테스트

1. 와이파이 + LTE 기기에서 PTT 테스트
2. 콘솔 로그 확인:
   ```
   [WebRTC] ice candidate { type: 'relay' }
   ```
   - `relay`가 보이면 TURN 서버를 통해 연결된 것입니다.

---

## 🔒 보안 권장사항

1. **강력한 비밀번호 사용**
   ```bash
   openssl rand -hex 16
   ```

2. **TLS/DTLS 활성화** (프로덕션)
   ```ini
   cert=/path/to/cert.pem
   pkey=/path/to/key.pem
   ```

3. **방화벽 규칙 최소화**
   - 필요한 포트만 열기

4. **로그 모니터링**
   ```bash
   sudo tail -f /var/log/turnserver.log
   ```

---

## 🐛 문제 해결

### Coturn이 시작되지 않음

```bash
# 로그 확인
sudo journalctl -u coturn -n 50

# 설정 파일 문법 확인
sudo turnserver -c /etc/turnserver.conf --test
```

### 연결 실패

1. **공인 IP 확인**
   ```bash
   curl ifconfig.me
   # 설정 파일의 external-ip와 일치하는지 확인
   ```

2. **방화벽 확인**
   ```bash
   sudo ufw status
   sudo iptables -L -n
   ```

3. **포트 리스닝 확인**
   ```bash
   sudo netstat -tulpn | grep 3478
   ```

### 성능 이슈

- `max-bps`, `total-quota`, `user-quota` 값 조정
- 서버 리소스 모니터링

---

## 📚 참고 자료

- [Coturn 공식 문서](https://github.com/coturn/coturn)
- [WebRTC TURN 서버 가이드](https://webrtc.org/getting-started/turn-server)
- [STUN vs TURN](https://www.webrtc-experiment.com/docs/STUN-TURN.html)

---

## 💡 팁

- **개발 환경**: 무료 TURN 서버 사용 가능 (Metered.ca Open Relay)
- **프로덕션**: 자체 TURN 서버 구축 권장 (보안, 성능)
- **모니터링**: PM2 또는 systemd로 자동 재시작 설정

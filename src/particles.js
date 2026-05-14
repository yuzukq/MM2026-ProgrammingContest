// particles.js
// パーティクルエフェクトの生成・更新・描画を担当する。状態は ParticleSystem クラスに閉じる。

const RESULT_CONFIG = {
  PERFECT: { color: "#FFD700", count: 18, speed: 1.8 },
  GOOD: { color: "#20B2AA", count: 10, speed: 1.3 },
  BAD: { color: "#888888", count: 5, speed: 0.8 },
};

class ParticleSystem {
  #particles = [];

  // 正しく触れている間、毎フレーム呼ぶ
  spawnTouchingFlash(normalizedY, judgmentX, canvasHeight) {
    const y = (1 - normalizedY) * canvasHeight;
    // 少数の粒子を右方向に広げる（接触中の継続演出）
    for (let i = 0; i < 2; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 0.6; // 右向き扇形
      const speed = 1 + Math.random() * 2;
      this.#particles.push({
        x: judgmentX,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        decay: 0.06,
        color: "#FFFFFF",
        size: 2 + Math.random() * 2,
      });
    }
  }

  // ブロック判定確定時に1回呼ぶ
  spawnResult(normalizedY, rating, judgmentX, canvasHeight) {
    const cfg = RESULT_CONFIG[rating] ?? RESULT_CONFIG.BAD;
    const y = (1 - normalizedY) * canvasHeight;
    for (let i = 0; i < cfg.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random() * 1.5) * cfg.speed;
      this.#particles.push({
        x: judgmentX,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.03,
        color: cfg.color,
        size: 3 + Math.random() * 3,
      });
    }
  }

  // 毎フレーム呼ぶ。更新・描画・寿命切れ削除を一括処理
  update(ctx) {
    this.#particles = this.#particles.filter((p) => p.life > 0);
    for (const p of this.#particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // 重力
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export const particleSystem = new ParticleSystem();

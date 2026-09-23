import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './OrderSuccessAnimation.css';

const rand = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const palette = ['#4ade80', '#60a5fa', '#f472b6', '#f59e0b', '#10b981', '#8b5cf6'];

const Confetti = ({ count = 60 }) => {
  const items = useMemo(
    () => Array.from({ length: count }, () => ({
      left: rand(0, 100),
      delay: rand(0, 1000),
      duration: rand(2000, 4000),
      color: pick(palette),
      rotate: rand(0, 360),
      size: rand(8, 16),
    })),
    [count]
  );

  return (
    <div className="confetti" aria-hidden>
      {items.map((it, i) => (
        <div
          key={i}
          className="confetti-item"
          style={{
            left: `${it.left}%`,
            background: it.color,
            animationDelay: `${it.delay}ms`,
            animationDuration: `${it.duration}ms`,
          }}
        />
      ))}
    </div>
  );
};

const BubblesBackground = ({ count = 15 }) => {
  const bubbles = useMemo(
    () => Array.from({ length: count }, () => ({
      left: rand(0, 100),
      size: rand(40, 120),
      delay: rand(0, 5000),
      duration: rand(10000, 20000),
    })),
    [count]
  );

  return (
    <div className="bubbles-bg">
      {bubbles.map((bubble, i) => (
        <div
          key={i}
          className="bubble"
          style={{
            left: `${bubble.left}%`,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            animationDelay: `${bubble.delay}ms`,
            animationDuration: `${bubble.duration}ms`,
          }}
        />
      ))}
    </div>
  );
};

export default function OrderSuccessAnimation({
  title = 'Order Confirmed!',
  subtitle = 'Thank you for your purchase',
  orderId,
}) {
  const shortId = orderId ? String(orderId).slice(-6).toUpperCase() : '';
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onEnd = () => {
      if (!exiting) return;
      if (orderId) {
        navigate(`/order/${orderId}`, { replace: true });
      } else {
        navigate('/orders', { replace: true });
      }
    };
    el.addEventListener('animationend', onEnd);
    return () => el.removeEventListener('animationend', onEnd);
  }, [exiting, navigate, orderId]);

  const handleContinue = () => {
    if (exiting) return;
    setExiting(true);
  };

  return (
    <div className="order-success-overlay" onClick={handleContinue}>
      <BubblesBackground />
      <Confetti />

      <div ref={cardRef} className={`order-success-card ${exiting ? 'exit' : ''}`}>
        <div className="checkmark">
          <svg viewBox="0 0 100 100" aria-hidden>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#26a69a" />
                <stop offset="55%" stopColor="#1e88e5" />
              </linearGradient>
            </defs>
            <circle className="checkmark__circle" cx="50" cy="50" r="44" stroke="url(#g)" strokeWidth="6" fill="none" />
            <path className="checkmark__check" d="M30 50 L45 65 L70 35" stroke="url(#g)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div className="checkmark-pulse" />
        </div>

        <h3 className="order-success-title">{title}</h3>
        <div className="order-success-subtitle">{subtitle}</div>
        {shortId && <div className="order-success-note ref-code">Order ID: #{shortId}</div>}
        <div className="order-success-note tap-note">Tap to continue</div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";

const Timer = ({ startTime }) => {
  const [timeLeft, setTimeLeft] = useState(getRemainingTime());

  function getRemainingTime() {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + 15 * 60 * 1000);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) return "00:00";

    const minutes = String(Math.floor(diff / 1000 / 60)).padStart(2, "0");
    const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getRemainingTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="text-[10px] text-green-500 dark:text-green-500 font-mono">
      {timeLeft}
    </span>
  );
};

export default Timer;

import React, { useEffect, useState } from "react";
import ReactPlayer from "react-player";

export default function VideoModal({ isOpen, onClose }) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setPlay(true), 100);
      return () => clearTimeout(timer);
    } else {
      setPlay(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: "100vw",
        backgroundColor: "rgba(0,0,0,0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        animation: "fadeIn 0.3s ease",
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          position: "relative",
          width: "90%",
          maxWidth: "800px",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          backgroundColor: "#000",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Responsive 16:9 container */}
        <div style={{ position: "relative", paddingTop: "56.25%" }}>
          <ReactPlayer
            src="https://www.youtube.com/watch?v=LXb3EKWsInQ"
            playing={play}
            controls
            width="100%"
            height="100%"
            style={{ position: "absolute", top: 0, left: 0 }}
          />
        </div>
      </div>
    </div>
  );
}

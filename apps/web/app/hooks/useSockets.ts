import { useEffect, useState } from "react";
import { WS_URL } from "../config";

export function useSocket() {
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<WebSocket>();

  useEffect(() => {
    console.log("connecting to ws");
    const ws =
      new WebSocket(`${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTM0OGU4My03NjM1LTQ0YmYtOWJjMy1kYWQ4YTVkYjdkN2UiLCJpYXQiOjE3NTM3OTU1ODQsImV4cCI6MTc1NjM4NzU4NH0.RmXsWm_Heb708PckV5yhzMzrXFkWG_QsIBUhrh7CQ1c
`);
    console.log("opening to ws");

    ws.onopen = () => {
      setLoading(false);
      setSocket(ws);
    };
  }, []);

  return {
    socket,
    loading,
  };
}

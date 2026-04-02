"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { onToast, offToast } from "@/lib/toast";
import type { ToastType } from "@/lib/toast";
import Toast from "./Toast";

export default function ToastProvider() {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("success");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, t: ToastType) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    setType(t);
    setVisible(true);
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, 4000);
  }, []);

  useEffect(() => {
    onToast(showToast);
    return () => {
      offToast();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showToast]);

  if (!message) return null;

  return <Toast message={message} type={type} visible={visible} />;
}

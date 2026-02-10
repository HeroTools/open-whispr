import { useState, useEffect } from "react";
import { getDefaultHotkey } from "../utils/hotkeys";

export const useHotkey = () => {
  const [hotkey, setHotkey] = useState(getDefaultHotkey());

  useEffect(() => {
    // Load hotkey from localStorage on mount
    const savedHotkey = localStorage.getItem("dictationKey");
    if (savedHotkey) {
      setHotkey(savedHotkey);
    } else {
      setHotkey(getDefaultHotkey());
    }
  }, []);

  return {
    hotkey,
    setHotkey,
  };
};

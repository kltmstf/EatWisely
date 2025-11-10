// hooks/useBackHandler.js
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

const useBackHandler = (onBackPress) => {
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => backHandler.remove();
  }, [onBackPress]);
};

export default useBackHandler; 
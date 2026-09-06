import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Vrai quand le clavier logiciel est affiché. Sur iOS on écoute les
 * événements « will » pour réagir en même temps que l'animation du clavier.
 * Toujours faux sur le web.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

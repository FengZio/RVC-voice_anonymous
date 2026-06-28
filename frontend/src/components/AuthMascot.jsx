import React from 'react';
import EyeBall from './EyeBall.jsx';

export default function AuthMascot({ mode, role, focusField, filled, password, showPassword }) {
  const [mouseX, setMouseX] = React.useState(0);
  const [mouseY, setMouseY] = React.useState(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = React.useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = React.useState(false);
  const [isTyping, setIsTyping] = React.useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = React.useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = React.useState(false);
  const [characterPositions, setCharacterPositions] = React.useState({
    purple: { faceX: 0, faceY: 0, bodySkew: 0 },
    black: { faceX: 0, faceY: 0, bodySkew: 0 },
    yellow: { faceX: 0, faceY: 0, bodySkew: 0 },
    orange: { faceX: 0, faceY: 0, bodySkew: 0 },
  });
  const purpleRef = React.useRef(null);
  const blackRef = React.useRef(null);
  const yellowRef = React.useRef(null);
  const orangeRef = React.useRef(null);

  const isRegister = mode === 'register';

  React.useEffect(() => {
    const typing = focusField === 'username' || focusField === 'password' || focusField === 'displayName' || focusField === 'title' || focusField === 'department';
    setIsTyping(typing);
  }, [focusField]);

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  React.useEffect(() => {
    if (isTyping) {
      const activateTimer = setTimeout(() => setIsLookingAtEachOther(true), 0);
      const timer = setTimeout(() => setIsLookingAtEachOther(false), 800);
      return () => {
        clearTimeout(activateTimer);
        clearTimeout(timer);
      };
    }

    const deactivateTimer = setTimeout(() => setIsLookingAtEachOther(false), 0);
    return () => clearTimeout(deactivateTimer);
  }, [isTyping]);

  React.useEffect(() => {
    if (password.length > 0 && showPassword) {
      const schedulePeek = () => {
        const peekInterval = setTimeout(() => {
          setIsPurplePeeking(true);
          setTimeout(() => setIsPurplePeeking(false), 800);
        }, Math.random() * 3000 + 2000);
        return peekInterval;
      };

      const firstPeek = schedulePeek();
      return () => clearTimeout(firstPeek);
    }

    const resetTimer = setTimeout(() => setIsPurplePeeking(false), 0);
    return () => clearTimeout(resetTimer);
  }, [password, showPassword, isPurplePeeking]);

  React.useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;

    const scheduleBlink = (setter) => {
      const blinkTimeout = setTimeout(() => {
        setter(true);
        setTimeout(() => {
          setter(false);
          scheduleBlink(setter);
        }, 150);
      }, getRandomBlinkInterval());

      return blinkTimeout;
    };

    const purpleTimeout = scheduleBlink(setIsPurpleBlinking);
    const blackTimeout = scheduleBlink(setIsBlackBlinking);
    return () => {
      clearTimeout(purpleTimeout);
      clearTimeout(blackTimeout);
    };
  }, []);

  React.useEffect(() => {
    const calculatePosition = (ref) => {
      if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };

      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 3;

      const deltaX = mouseX - centerX;
      const deltaY = mouseY - centerY;

      const faceX = Math.max(-15, Math.min(15, deltaX / 20));
      const faceY = Math.max(-10, Math.min(10, deltaY / 30));
      const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120));

      return { faceX, faceY, bodySkew };
    };

    setCharacterPositions({
      purple: calculatePosition(purpleRef),
      black: calculatePosition(blackRef),
      yellow: calculatePosition(yellowRef),
      orange: calculatePosition(orangeRef),
    });
  }, [mouseX, mouseY]);

  const purplePos = characterPositions.purple;
  const blackPos = characterPositions.black;
  const yellowPos = characterPositions.yellow;
  const orangePos = characterPositions.orange;

  return (
    <div className="authMascot" aria-hidden="true">
      <div className="authMascotScene">
        <div className="authMascotGrid" />
        <div className="authMascotGlow" />
        <div className="authMascotShadow" />
        <div className="character-stage" style={{ width: '550px', height: '400px' }}>
          <div
            ref={purpleRef}
            className="character"
            style={{
              left: '70px',
              width: '180px',
              height: (isTyping || (password.length > 0 && !showPassword)) ? '440px' : '400px',
              backgroundColor: '#6C3FF5',
              borderRadius: '10px 10px 0 0',
              zIndex: 1,
              transform: (password.length > 0 && showPassword)
                ? 'skewX(0deg)'
                : (isTyping || (password.length > 0 && !showPassword))
                  ? `skewX(${(purplePos.bodySkew || 0) * 1.5}deg)`
                  : `skewX(${purplePos.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div
              className="character__eyes flex gap-6"
              style={{
                left: (password.length > 0 && showPassword) ? '26px' : `${30 + purplePos.faceX}px`,
                top: (password.length > 0 && showPassword) ? '26px' : `${34 + purplePos.faceY}px`,
              }}
            >
              <EyeBall
                size={14}
                pupilSize={4}
                maxDistance={5}
                eyeColor="white"
                pupilColor="#2D2D2D"
                isBlinking={isPurpleBlinking}
                forceLookX={isPurplePeeking || (password.length > 0 && showPassword) ? -2 : undefined}
                forceLookY={isPurplePeeking || (password.length > 0 && showPassword) ? -2 : undefined}
              />
              <EyeBall
                size={14}
                pupilSize={4}
                maxDistance={5}
                eyeColor="white"
                pupilColor="#2D2D2D"
                isBlinking={isPurpleBlinking}
                forceLookX={isPurplePeeking || (password.length > 0 && showPassword) ? -2 : undefined}
                forceLookY={isPurplePeeking || (password.length > 0 && showPassword) ? -2 : undefined}
              />
            </div>
          </div>

          <div
            ref={blackRef}
            className="character"
            style={{
              left: '280px',
              width: '120px',
              height: '310px',
              backgroundColor: '#2D2D2D',
              borderRadius: '8px 8px 0 0',
              zIndex: 2,
              transform: (password.length > 0 && showPassword)
                ? 'skewX(0deg)'
                : isLookingAtEachOther
                  ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                  : (isTyping || (password.length > 0 && !showPassword))
                    ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)`
                    : `skewX(${blackPos.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div
              className="character__eyes flex gap-6"
              style={{
                left: (password.length > 0 && showPassword) ? '26px' : isLookingAtEachOther ? '28px' : `${30 + blackPos.faceX}px`,
                top: (password.length > 0 && showPassword) ? '26px' : isLookingAtEachOther ? '26px' : `${34 + blackPos.faceY}px`,
              }}
            >
              <EyeBall
                size={14}
                pupilSize={4}
                maxDistance={5}
                eyeColor="white"
                pupilColor="#2D2D2D"
                isBlinking={isBlackBlinking}
                forceLookX={(password.length > 0 && showPassword) ? -2 : isLookingAtEachOther ? 1 : undefined}
                forceLookY={(password.length > 0 && showPassword) ? -2 : isLookingAtEachOther ? -1 : undefined}
              />
              <EyeBall
                size={14}
                pupilSize={4}
                maxDistance={5}
                eyeColor="white"
                pupilColor="#2D2D2D"
                isBlinking={isBlackBlinking}
                forceLookX={(password.length > 0 && showPassword) ? -2 : isLookingAtEachOther ? 1 : undefined}
                forceLookY={(password.length > 0 && showPassword) ? -2 : isLookingAtEachOther ? -1 : undefined}
              />
            </div>
          </div>

          <div
            ref={orangeRef}
            className="character"
            style={{
              left: '0px',
              width: '240px',
              height: '200px',
              zIndex: 3,
              backgroundColor: '#FF9B6B',
              borderRadius: '120px 120px 0 0',
              transform: (password.length > 0 && showPassword) ? 'skewX(0deg)' : `skewX(${orangePos.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div
              className="character__eyes character__eyes--fast flex gap-8"
              style={{
                left: (password.length > 0 && showPassword) ? '76px' : `${78 + (orangePos.faceX || 0)}px`,
                top: (password.length > 0 && showPassword) ? '92px' : `${86 + (orangePos.faceY || 0)}px`,
              }}
            >
              <span className="character__eye character__eye--dot" />
              <span className="character__eye character__eye--dot" />
            </div>
          </div>

          <div
            ref={yellowRef}
            className="character"
            style={{
              left: '310px',
              width: '140px',
              height: '230px',
              backgroundColor: '#E8D754',
              borderRadius: '70px 70px 0 0',
              zIndex: 4,
              transform: (password.length > 0 && showPassword) ? 'skewX(0deg)' : `skewX(${yellowPos.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div
              className="character__eyes character__eyes--fast flex gap-6"
              style={{
                left: (password.length > 0 && showPassword) ? '44px' : `${48 + (yellowPos.faceX || 0)}px`,
                top: (password.length > 0 && showPassword) ? '38px' : `${42 + (yellowPos.faceY || 0)}px`,
              }}
            >
              <EyeBall
                size={13}
                maxDistance={5}
                eyeColor="#2D2D2D"
                pupilSize={3}
                pupilColor="#2D2D2D"
                forceLookX={0}
                forceLookY={0}
              />
              <EyeBall
                size={13}
                maxDistance={5}
                eyeColor="#2D2D2D"
                pupilSize={3}
                pupilColor="#2D2D2D"
                forceLookX={0}
                forceLookY={0}
              />
            </div>
            <div
              className="character__mouth"
              style={{
                left: (password.length > 0 && showPassword) ? '10px' : `${40 + (yellowPos.faceX || 0)}px`,
                top: (password.length > 0 && showPassword) ? '88px' : `${88 + (yellowPos.faceY || 0)}px`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

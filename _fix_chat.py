with open(r'E:\RVC-voice_anonymous\frontend\src\pages\PatientDashboard\index.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix line 604 - the template literal
# It should be: className={${styles.chatBubble} }
new_className = '                  className={' + chr(36) + '{styles.chatBubble} ' + chr(36) + "{msg.from === 'patient' ? styles.chatBubbleOut : styles.chatBubbleIn}" + chr(96) + '}' + chr(10)

lines[603] = new_className

with open(r'E:\RVC-voice_anonymous\frontend\src\pages\PatientDashboard\index.jsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('FIXED line 604')

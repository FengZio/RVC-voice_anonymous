css_path = r'E:\RVC-voice_anonymous\frontend\src\pages\DoctorDashboard\DoctorDashboard.module.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Replace flex-based workflowMain with grid
old_main = """.workflowMain {
  display: flex;
  gap: 16px;
  align-items: stretch;
  min-height: 0;
}"""

new_main = """.workflowMain {
  display: grid;
  grid-template-columns: auto 340px;
  gap: 16px;
  align-items: start;
  min-height: 0;
}"""

css = css.replace(old_main, new_main)

# workflowLeft: remove flex:1 (grid handles sizing), keep flex column internals
old_left = """.workflowLeft {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}"""

new_left = """.workflowLeft {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}"""

css = css.replace(old_left, new_left)

# workflowRight: remove width and flex-shrink (grid column handles sizing)
old_right = """.workflowRight {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}"""

new_right = """.workflowRight {
  display: flex;
  flex-direction: column;
  min-height: 0;
}"""

css = css.replace(old_right, new_right)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

print('Grid layout applied')

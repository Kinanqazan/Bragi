const stylesheet = `
.RaBulkActionsToolbar .MuiButton-label {
  color: white;
}

a[aria-current="page"] {
  color: #c231ab !important;
  font-weight: bold;
}

a[aria-current="page"] .MuiListItemIcon-root {
  color: #c231ab !important;
}

.panel-content {
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg, #311f2f, #0a0912, #2f0c28);
  background-size: 300% 300%;
  animation: gradientFlow 10s ease-in-out infinite;
}

.panel-content::before {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 0px,
    rgba(255, 255, 255, 0.05) 2px,
    transparent 1px,
    transparent 3px
  );
  animation: equalizer 1.8s infinite ease-in-out;
  filter: blur(1px);
  opacity: 0.5;
}

@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes backgroundFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes equalizer {
  0%, 100% { transform: scaleY(1); opacity: 0.2; }
  25% { transform: scaleY(1.4); opacity: 0.9; }
  50% { transform: scaleY(0.7); opacity: 0.2; }
  75% { transform: scaleY(1.2); opacity: 0.8; }
}

@keyframes pulse {
  0% { opacity: 0.5; }
  100% { opacity: 1; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`
export default stylesheet

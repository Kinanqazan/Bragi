import React from 'react'
import PropTypes from 'prop-types'
import config from '../config'

let nextBragiLogoId = 0

const BragiLogo = ({
  color = 'currentColor',
  className,
  style,
  alt = 'Bragi',
  'aria-label': ariaLabel,
  ...props
}) => {
  const maskId = React.useRef(null)
  if (!maskId.current) {
    maskId.current = 'bragi-logo-mask-' + nextBragiLogoId++
  }

  const maskSource = (() => {
    if (typeof window === 'undefined') return '/bragi-logo-mask.png'

    // The Android WebView serves its bundled UI from /assets/index.html.
    if (window.location.pathname.startsWith('/assets/')) {
      return '/assets/bragi-logo-mask.png'
    }

    // Vite serves public files from the origin root during development. The
    // production server serves them below its UI mount (/app), including any
    // configured BasePath.
    if (import.meta.env.DEV) return '/bragi-logo-mask.png'

    const basePath = (config.baseURL || '').replace(/\/+$/, '')
    return `${basePath}/app/bragi-logo-mask.png`
  })()

  return (
    <svg
      version="1.0"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      className={className}
      style={style}
      role="img"
      aria-label={ariaLabel || alt}
      alt={alt}
      {...props}
    >
      <defs>
        <mask
          id={maskId.current}
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1024"
          height="1024"
        >
          <image
            href={maskSource}
            x="0"
            y="0"
            width="1024"
            height="1024"
            preserveAspectRatio="none"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="1024"
        height="1024"
        fill={color}
        mask={'url(#' + maskId.current + ')'}
      />
    </svg>
  )
}

BragiLogo.propTypes = {
  color: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  alt: PropTypes.string,
  'aria-label': PropTypes.string,
}

export default BragiLogo

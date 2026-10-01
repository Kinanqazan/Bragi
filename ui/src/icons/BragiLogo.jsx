import React from 'react'
import PropTypes from 'prop-types'

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

  const maskSource =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/assets/')
      ? '/assets/bragi-logo-mask.png'
      : '/bragi-logo-mask.png'

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

import React, { Suspense } from 'react'
import { LinearProgress } from '@material-ui/core'

export const lazyLoad = (importFunc) => {
  const LazyComponent = React.lazy(importFunc)
  const WrappedComponent = (props) => (
    <Suspense
      // Keep the already-rendered app shell visible while a route chunk is
      // fetched. React Admin's <Loading /> is a full viewport spinner, which
      // makes a fast tab switch look like a page reload on mobile.
      fallback={<LinearProgress aria-label="Loading page" />}
    >
      <LazyComponent {...props} />
    </Suspense>
  )
  WrappedComponent.displayName = 'LazyLoadedComponent'
  return WrappedComponent
}

export default lazyLoad

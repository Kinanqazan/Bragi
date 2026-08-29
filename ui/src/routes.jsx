import React from 'react'
import { Route } from 'react-router-dom'
import { lazyLoad } from './common'
import { GenrePage, CategoryPage, MoodPage } from './discovery'

const Personal = lazyLoad(() => import('./personal/Personal'))

const routes = [
  <Route exact path="/personal" component={Personal} key={'personal'} />,
  <Route exact path="/genres" component={GenrePage} key="genres" />,
  <Route exact path="/categories" component={CategoryPage} key="categories" />,
  <Route exact path="/moods" component={MoodPage} key="moods" />,
]

export default routes

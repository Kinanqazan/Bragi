import React, { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Field, Form } from 'react-final-form'
import { useDispatch } from 'react-redux'
import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import Link from '@material-ui/core/Link'
import TextField from '@material-ui/core/TextField'
import { ThemeProvider, createTheme, makeStyles } from '@material-ui/core/styles'
import {
  useLogin,
  useNotify,
  useTranslate,
  useVersion,
} from 'react-admin'
import BragiLogo from '../icons/BragiLogo'

import Notification from './Notification'
import useCurrentTheme from '../themes/useCurrentTheme'
import config from '../config'
import { clearQueue } from '../actions'
import { INSIGHTS_DOC_URL } from '../consts.js'

const useStyles = makeStyles(
  (theme) => ({
    main: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      alignItems: 'center',
      justifyContent: 'center',
      padding:
        'max(env(safe-area-inset-top, 0px), 32px) 20px max(env(safe-area-inset-bottom, 0px), 32px)',
      boxSizing: 'border-box',
      backgroundColor: '#121212',
      overflowY: 'auto',
    },
    content: {
      width: '100%',
      maxWidth: 340,
      margin: 'auto 0',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    logoContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: '32px',
    },
    logo: {
      width: 112,
      height: 112,
      color: theme.palette.primary.main || '#2196f3',
      filter: 'drop-shadow(0 6px 20px rgba(33, 150, 243, 0.35))',
      [theme.breakpoints.down('xs')]: {
        width: 96,
        height: 96,
        marginBottom: '4px',
      },
    },
    welcome: {
      marginBottom: '16px',
      padding: '0 4px',
      display: 'flex',
      justifyContent: 'center',
      textAlign: 'center',
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: '0.9rem',
    },
    form: {
      width: '100%',
      padding: 0,
    },
    input: {
      width: '100%',
      marginTop: '16px',
      '& .MuiOutlinedInput-root': {
        height: 50,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        transition: 'all 0.2s ease',
        '& fieldset': {
          borderColor: 'rgba(255, 255, 255, 0.14)',
        },
        '&:hover fieldset': {
          borderColor: 'rgba(255, 255, 255, 0.3)',
        },
        '&.Mui-focused fieldset': {
          borderColor: '#2196f3',
          borderWidth: 1.5,
          boxShadow: '0 0 0 3px rgba(33, 150, 243, 0.2)',
        },
      },
      '& .MuiInputLabel-outlined': {
        color: 'rgba(255, 255, 255, 0.65)',
        transform: 'translate(16px, 15px) scale(1)',
      },
      '& .MuiInputLabel-outlined.MuiInputLabel-shrink': {
        transform: 'translate(14px, -6px) scale(0.75)',
      },
      '& .MuiInputLabel-outlined.Mui-focused': {
        color: '#2196f3',
      },
      '& .MuiOutlinedInput-input': {
        color: '#ffffff',
        height: '100%',
        boxSizing: 'border-box',
        padding: '0 16px',
        fontSize: '0.95rem',
        textAlign: 'left',
        '&:-webkit-autofill': {
          WebkitBoxShadow: '0 0 0 1000px #1e1e24 inset !important',
          WebkitTextFillColor: '#ffffff !important',
          borderRadius: 14,
          textAlign: 'left',
        },
      },
      '& .MuiFormHelperText-root': {
        marginLeft: '4px',
      },
    },
    actions: {
      width: '100%',
      padding: '24px 0 0 0',
    },
    button: {
      height: 48,
      borderRadius: 14,
      background: 'linear-gradient(135deg, #1976d2 0%, #2196f3 100%) !important',
      color: '#ffffff !important',
      fontWeight: 600,
      fontSize: '0.95rem',
      letterSpacing: '0.01em',
      textTransform: 'none',
      boxShadow: '0 8px 24px -4px rgba(33, 150, 243, 0.45) !important',
      transition: 'all 0.2s ease',
      '&:hover': {
        background: 'linear-gradient(135deg, #1565c0 0%, #1e88e5 100%) !important',
        boxShadow: '0 12px 28px -4px rgba(33, 150, 243, 0.55) !important',
        transform: 'translateY(-1px)',
      },
      '&:active': {
        transform: 'translateY(0)',
      },
      '&.Mui-disabled': {
        opacity: 0.6,
        color: 'rgba(255, 255, 255, 0.5) !important',
      },
    },
    message: {
      marginTop: '1.4em',
      padding: '0 0.5em',
      textAlign: 'center',
      wordBreak: 'break-word',
      fontSize: '0.8rem',
      color: 'rgba(255, 255, 255, 0.5)',
      '& a': {
        color: theme.palette.primary.main,
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline',
        },
      },
    },
    // Backwards-compatible aliases for themes targeting old NDLogin classes
    card: {
      background: 'transparent !important',
      boxShadow: 'none !important',
      border: 'none !important',
    },
    avatar: {
      display: 'none',
    },
    systemName: {
      display: 'none',
    },
  }),
  { name: 'BragiLogin' },
)

const renderInput = ({
  meta: { touched, error } = {},
  input: { ...inputProps },
  ...props
}) => (
  <TextField
    variant="outlined"
    error={!!(touched && error)}
    inputProps={{
      // mobile keyboards: suppress capitalization and correction for login related fields
      autoCapitalize: 'none',
      autoCorrect: 'off',
      ...inputProps,
    }}
    helperText={touched && error}
    {...props}
    fullWidth
  />
)

const FormLogin = ({ loading, handleSubmit, validate }) => {
  const translate = useTranslate()
  const classes = useStyles()

  return (
    <Form
      onSubmit={handleSubmit}
      validate={validate}
      render={({ handleSubmit }) => (
        <form onSubmit={handleSubmit} noValidate>
          <div className={classes.main}>
            <div className={classes.content}>
              <div className={classes.logoContainer}>
                <BragiLogo className={classes.logo} />
              </div>
              {config.welcomeMessage && (
                <div
                  className={classes.welcome}
                  // Use dangerouslySetInnerHTML to allow admins to configure
                  // whatever content they want
                  dangerouslySetInnerHTML={{ __html: config.welcomeMessage }}
                />
              )}
              <div className={classes.form}>
                <div className={classes.input}>
                  <Field
                    autoFocus
                    name="username"
                    component={renderInput}
                    label={translate('ra.auth.username')}
                    disabled={loading}
                    spellCheck={false}
                  />
                </div>
                <div className={classes.input}>
                  <Field
                    name="password"
                    component={renderInput}
                    label={translate('ra.auth.password')}
                    type="password"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className={classes.actions}>
                <Button
                  variant="contained"
                  type="submit"
                  color="primary"
                  disabled={loading}
                  className={classes.button}
                  fullWidth
                >
                  {loading && (
                    <CircularProgress
                      size={20}
                      thickness={3}
                      style={{ color: '#ffffff', marginRight: 8 }}
                    />
                  )}
                  {translate('ra.auth.sign_in')}
                </Button>
              </div>
            </div>
            <Notification />
          </div>
        </form>
      )}
    />
  )
}

const InsightsNotice = ({ url }) => {
  const translate = useTranslate()
  const classes = useStyles()

  const anchorRegex = /\[(.+?)]/g
  const originalMsg = translate('ra.auth.insightsCollectionNote')

  // Split the entire message on newlines
  const lines = originalMsg.split('\n')

  const renderedLines = lines.map((line, lineIndex) => {
    const segments = []
    let lastIndex = 0
    let match

    // Find bracketed text in each line
    while ((match = anchorRegex.exec(line)) !== null) {
      const bracketText = match[1]

      segments.push(line.slice(lastIndex, match.index))
      segments.push(
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          key={`${lineIndex}-${match.index}`}
          style={{ cursor: 'pointer' }}
        >
          {bracketText}
        </Link>,
      )
      lastIndex = match.index + match[0].length
    }

    segments.push(line.slice(lastIndex))

    return (
      <React.Fragment key={lineIndex}>
        {segments}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    )
  })

  return <div className={classes.message}>{renderedLines}</div>
}

const FormSignUp = ({ loading, handleSubmit, validate }) => {
  const translate = useTranslate()
  const classes = useStyles()

  return (
    <Form
      onSubmit={handleSubmit}
      validate={validate}
      render={({ handleSubmit }) => (
        <form onSubmit={handleSubmit} noValidate>
          <div className={classes.main}>
            <div className={classes.content}>
              <div className={classes.logoContainer}>
                <BragiLogo className={classes.logo} />
              </div>
              <div className={classes.welcome}>
                {translate('ra.auth.welcome1')} - {translate('ra.auth.welcome2')}
              </div>
              <div className={classes.form}>
                <div className={classes.input}>
                  <Field
                    autoFocus
                    name="username"
                    component={renderInput}
                    label={translate('ra.auth.username')}
                    disabled={loading}
                    spellCheck={false}
                  />
                </div>
                <div className={classes.input}>
                  <Field
                    name="password"
                    component={renderInput}
                    label={translate('ra.auth.password')}
                    type="password"
                    disabled={loading}
                  />
                </div>
                <div className={classes.input}>
                  <Field
                    name="confirmPassword"
                    component={renderInput}
                    label={translate('ra.auth.confirmPassword')}
                    type="password"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className={classes.actions}>
                <Button
                  variant="contained"
                  type="submit"
                  color="primary"
                  disabled={loading}
                  className={classes.button}
                  fullWidth
                >
                  {loading && (
                    <CircularProgress
                      size={20}
                      thickness={3}
                      style={{ color: '#ffffff', marginRight: 8 }}
                    />
                  )}
                  {translate('ra.auth.buttonCreateAdmin')}
                </Button>
              </div>
              <InsightsNotice url={INSIGHTS_DOC_URL} />
            </div>
            <Notification />
          </div>
        </form>
      )}
    />
  )
}

const Login = ({ location }) => {
  const [loading, setLoading] = useState(false)
  const translate = useTranslate()
  const notify = useNotify()
  const login = useLogin()
  const dispatch = useDispatch()

  const handleSubmit = useCallback(
    (auth) => {
      setLoading(true)
      dispatch(clearQueue())
      login(auth, location.state ? location.state.nextPathname : '/').catch(
        (error) => {
          setLoading(false)
          notify(
            typeof error === 'string'
              ? error
              : typeof error === 'undefined' || !error.message
                ? 'ra.auth.sign_in_error'
                : error.message,
            'warning',
          )
        },
      )
    },
    [dispatch, login, notify, setLoading, location],
  )

  const validateLogin = useCallback(() => ({}), [])

  const validateSignup = useCallback(
    (values) => {
      const errors = {}
      const regex = /^\w+$/g
      if (!values.username) {
        errors.username = translate('ra.validation.required')
      } else if (!values.username.match(regex)) {
        errors.username = translate('ra.validation.invalidChars')
      }
      if (!values.password) {
        errors.password = translate('ra.validation.required')
      }
      if (!values.confirmPassword) {
        errors.confirmPassword = translate('ra.validation.required')
      }
      if (values.confirmPassword !== values.password) {
        errors.confirmPassword = translate('ra.validation.passwordDoesNotMatch')
      }
      return errors
    },
    [translate],
  )

  if (config.firstTime) {
    return (
      <FormSignUp
        handleSubmit={handleSubmit}
        validate={validateSignup}
        loading={loading}
      />
    )
  }
  return (
    <FormLogin
      handleSubmit={handleSubmit}
      validate={validateLogin}
      loading={loading}
    />
  )
}

Login.propTypes = {
  authProvider: PropTypes.func,
  previousRoute: PropTypes.string,
}

// We need to put the ThemeProvider decoration in another component
// Because otherwise the useStyles() hook used in Login won't get
// the right theme
const LoginWithTheme = (props) => {
  const theme = useCurrentTheme()
  const version = useVersion()

  return (
    <ThemeProvider theme={createTheme(theme)}>
      <Login key={version} {...props} />
    </ThemeProvider>
  )
}

export default LoginWithTheme

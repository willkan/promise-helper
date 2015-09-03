'use strict'

var CustomPromise = Promise

function toArray (obj, sliceBegin) {
  return Array.prototype.slice.call(obj, sliceBegin || 0)
}

function isFunction (obj) {
  return Object.prototype.toString.call(obj) === '[object Function]'
}

function cancelable (fn, msg) {
  var _reject
  var promise = new CustomPromise(function (resolve, reject) {
    _reject = reject
    fn(resolve, reject)
  })
  promise.cancel = function () {
    _reject(new Error(msg || 'promise is canceled'))
    promise.cancel = null
    promise.isCancel = true
    _reject = null
  }
  return promise
}

var helper = {
  setPromise: function (_Promise) {
    CustomPromise = _Promise
  },
  promisify: function promisify(func, opt) {
    return function () {
      var args = toArray(arguments)
      return new CustomPromise(function (resolve, reject) {
        args.push(function (err) {
          var res = toArray(arguments, 1)
          if (opt && opt.withError === false) {
            res = [err].concat(res)
            err = null
          }
          if (err) return reject(err)
          if (res.length === 1) return resolve(res[0])
          resolve(res)
        })
        func.apply(null, args)
      })
    }
  },
  all: function all(promises) {
    var result = []
    var counter = promises.length
    return new CustomPromise(function (resolve, reject) {
      var isErrorCaught = false
      promises.forEach(function (promise, index) {
        promise.then(function (data) {
          if (isErrorCaught) return
          result[index] = data
          counter--
          if (counter === 0) return resolve(result)
        }, function (err) {
          isErrorCaught = true
          reject(err)
        })
      })
    })
  },
  props: function props(promises) {
    var result = {}
    var keys = Object.keys(promises)
    var counter = keys.length
    return new CustomPromise(function (resolve, reject) {
      var isErrorCaught = false
      keys.forEach(function (key) {
        var promise = promises[key]
        promise.then(function (data) {
          if (isErrorCaught) return
          result[key] = data
          counter--
          if (counter === 0) return resolve(result)
        }, function (err) {
          isErrorCaught = true
          reject(err)
        })
      })
    })
  },
  cancelable: cancelable,
  sleep: function sleep(timeout) {
    var promise = new CustomPromise(function (resolve, reject) {
      setTimeout(resolve, timeout)
    })
    return promise
  },
  delay: function delay(func, timeout) {
    var promise = cancelable(function (resolve, reject) {
      setTimeout(function () {
        if (!promise.isCancel) return resolve(Promise.resolve().then(func))
      }, timeout)
    }, 'delay is canceled')
    return promise
  },
  interval: function interval(func, timeout) {
    var promise = cancelable(function (resolve, reject) {
      function run () {
        setTimeout(function () {
          if (!promise.isCancel) return Promise.resolve().then(func).then(run)
        }, timeout)
      }
      run()
    }, 'interval is canceled')
    return promise
  },
  retry: function retry(func, condition, timeout) {
    var promise = new CustomPromise(function (resolve, reject) {
      var lastError = new Error('retry failed')
      function run () {
        if (!condition()) {
          lastError.isRetryFailed = true
          return reject(lastError)
        }
        return Promise.resolve()
          .then(func)
          .then(resolve, function (err) {
            lastError = err
            return helper.sleep(isFunction(timeout) ? timeout() : timeout).then(run)
          })
      }
      return run()
    })
    return promise
  }
}

module.exports = helper
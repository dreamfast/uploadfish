package handlers

// LogError logs an error with context specific to handlers
func LogError(err error, message string, fields map[string]interface{}) {
	if err == nil {
		return
	}

	// Use the main logger
	logFields := make(map[string]interface{})
	for k, v := range fields {
		logFields[k] = v
	}
	logFields["component"] = "handlers"

	LogErrorFunc(err, message, logFields)
}

// LogInfo logs information with context specific to handlers
func LogInfo(message string, fields map[string]interface{}) {
	logFields := make(map[string]interface{})
	for k, v := range fields {
		logFields[k] = v
	}
	logFields["component"] = "handlers"

	LogInfoFunc(message, logFields)
}

// LogDebug logs debug information with context specific to handlers
func LogDebug(message string, fields map[string]interface{}) {
	logFields := make(map[string]interface{})
	for k, v := range fields {
		logFields[k] = v
	}
	logFields["component"] = "handlers"

	LogDebugFunc(message, logFields)
}

// These variables will be set by the main package
var (
	LogErrorFunc = func(err error, message string, fields map[string]interface{}) {}
	LogInfoFunc  = func(message string, fields map[string]interface{}) {}
	LogDebugFunc = func(message string, fields map[string]interface{}) {}
)

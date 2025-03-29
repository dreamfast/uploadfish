package handlers

// addComponentField adds the 'component' field to the fields map
func addComponentField(fields map[string]interface{}) map[string]interface{} {
	if fields == nil {
		return map[string]interface{}{"component": "handlers"}
	}

	// Make a copy to avoid modifying the original
	logFields := make(map[string]interface{})
	for k, v := range fields {
		logFields[k] = v
	}
	logFields["component"] = "handlers"

	return logFields
}

// LogError logs an error with context specific to handlers
func LogError(err error, message string, fields map[string]interface{}) {
	if err == nil {
		return
	}
	LogErrorFunc(err, message, addComponentField(fields))
}

// LogInfo logs information with context specific to handlers
func LogInfo(message string, fields map[string]interface{}) {
	LogInfoFunc(message, addComponentField(fields))
}

// LogDebug logs debug information with context specific to handlers
func LogDebug(message string, fields map[string]interface{}) {
	LogDebugFunc(message, addComponentField(fields))
}

// These variables will be set by the main package
var (
	LogErrorFunc = func(err error, message string, fields map[string]interface{}) {}
	LogInfoFunc  = func(message string, fields map[string]interface{}) {}
	LogDebugFunc = func(message string, fields map[string]interface{}) {}
)

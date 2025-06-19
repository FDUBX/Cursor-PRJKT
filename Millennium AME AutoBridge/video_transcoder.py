-- KVM API Functions for Adder AIM
-- Version: 1.0
-- Using Q-SYS specific extensions

-- Import required modules
local LuaXML = require("LuaXML")
local json = require("json")

-- Configuration
local config = {
    base_url = "http://192.168.10.200/api/",  -- Added trailing slash
    username = "admin",
    password = "admin",
    api_version = 15,  -- Updated to version 15
    check_interval = 5, -- Check for changes every 5 seconds
    token_timeout = 300 -- Token timeout in seconds (5 minutes)
}

-- Global variables
local token = nil
local token_timestamp = nil
local responseData = nil
local responseError = nil
local responseCode = nil
local requestTimer = Timer.New()
local checkTimer = Timer.New()

-- Helper function to check if token is valid
local function isTokenValid()
    if not token or not token_timestamp then
        return false
    end
    
    local current_time = os.time()
    local token_age = current_time - token_timestamp
    
    return token_age < config.token_timeout
end

-- Helper function to log table contents
local function logTable(tbl, prefix)
    prefix = prefix or ""
    for key, value in pairs(tbl) do
        if type(value) == "table" then
            if key == "devices" then
                print(prefix .. key .. ":")
                for i, device in ipairs(value) do
                    print(prefix .. "  Device " .. i .. ":")
                    for field, val in pairs(device) do
                        print(prefix .. "    " .. field .. ": " .. tostring(val))
                    end
                end
            else
                print(prefix .. key .. ":")
                logTable(value, prefix .. "  ")
            end
        else
            print(prefix .. key .. ": " .. tostring(value))
        end
    end
end

-- Helper function to format error message
local function formatError(err)
    if type(err) == "table" then
        local errorMessages = {}
        for _, errorInfo in ipairs(err) do
            local msg = errorInfo.msg or "Unknown error"
            local code = errorInfo.code or "Unknown code"
            table.insert(errorMessages, string.format("Error %s: %s", code, msg))
        end
        return table.concat(errorMessages, "; ")
    end
    return err and tostring(err) or "Unknown error"
end

-- Helper function to log device information
local function logDeviceInfo(device)
    print(string.format("Device: %s (ID: %s)", device.name or "Unknown", device.id or "Unknown"))
    print(string.format("  Type: %s", device.type or "Unknown"))
    print(string.format("  Status: %s", device.online == "1" and "Online" or "Offline"))
    print(string.format("  IP: %s", device.ip_address or "Unknown"))
    print(string.format("  MAC: %s", device.mac_address or "Unknown"))
    print(string.format("  Firmware: %s", device.firmware or "Unknown"))
    print(string.format("  Description: %s", device.description or "None"))
    print(string.format("  Presets: %s", device.count_receiver_presets or "0"))
    print(string.format("  Serial: %s", device.serial_number or "Unknown"))
    print(string.format("  Added: %s", device.date_added or "Unknown"))
    print("---")
end

-- Helper function to parse XML response
local function parseXMLResponse(xmlString)
    local doc
    if type(xmlString) == "string" then
        doc = LuaXML.eval(xmlString)
    elseif type(xmlString) == "table" then
        doc = xmlString
    else
        print("Error: Invalid XML response type")
        return nil, "Invalid XML response type"
    end
    
    if not doc then
        print("Error: Failed to parse XML response")
        return nil, "Failed to parse XML response"
    end
    
    -- DEBUG: Print the raw LuaXML structure
    print("DEBUG: LuaXML structure:")
    logTable(doc)
    
    local response = {}
    
    -- Helper function to get value from LuaXML node
    local function getNodeValue(node)
        if type(node) == "table" then
            if node[1] then
                return node[1]
            end
        end
        return ""
    end
    
    -- Helper function to process a node
    local function processNode(node, result)
        if type(node) ~= "table" then return end
        
        -- Process all child nodes
        for _, child in ipairs(node) do
            if type(child) == "table" then
                local tag = child[0]
                if tag then
                    if tag == "devices" then
                        result.devices = {}
                        for _, deviceNode in ipairs(child) do
                            if type(deviceNode) == "table" and deviceNode[0] == "device" then
                                local deviceData = {}
                                for _, field in ipairs(deviceNode) do
                                    if type(field) == "table" and field[0] then
                                        local fieldTag = field[0]
                                        local value = getNodeValue(field)
                                        local cleanTag = fieldTag:gsub("^d_", "")
                                        deviceData[cleanTag] = value
                                    end
                                end
                                table.insert(result.devices, deviceData)
                            end
                        end
                    else
                        result[tag] = getNodeValue(child)
                    end
                end
            end
        end
    end
    
    -- Process the root node
    processNode(doc, response)

    -- Debug output
    print("Final response structure:")
    for k, v in pairs(response) do
        if k == "devices" then
            print(string.format("  %s: %d devices", k, #v))
            for i, device in ipairs(v) do
                print(string.format("    Device %d:", i))
                for field, value in pairs(device) do
                    print(string.format("      %s: %s", field, value))
                end
            end
        else
            print(string.format("  %s: %s", k, v))
        end
    end
    
    return response
end

-- Helper function to make HTTP requests
local function makeRequest(method, params, callback)
    local url = config.base_url .. "?v=" .. config.api_version .. "&method=" .. method
    
    -- Add token if available
    if token then
        url = url .. "&token=" .. token
    end
    
    -- Add additional parameters
    for key, value in pairs(params) do
        if value ~= nil and value ~= "" then
            url = url .. "&" .. key .. "=" .. value
        end
    end
    
    print("Request: " .. method)
    print("URL: " .. url)
    
    local function handleResponse(tbl, code, data, err, headers)
        if code == 200 and data then
            print("Raw response:")
            print(data)
            print("---")
            
            local result, parseErr = parseXMLResponse(data)
            if result then
                -- Log the response based on the method
                if method == "get_devices" then
                    print(string.format("Found %s devices (Total: %s)", 
                        result.count_devices or 0, 
                        result.total_devices or 0))
                    
                    if result.devices and #result.devices > 0 then
                        print("Device details:")
                        for _, device in ipairs(result.devices) do
                            logDeviceInfo(device)
                        end
                    else
                        print("No device details found in response")
                    end
                elseif method == "get_presets" then
                    print("Presets found: " .. tostring(result.count_presets or 0))
                elseif method == "connect_channel" or method == "disconnect_channel" then
                    print("Operation " .. (result.success == "1" and "succeeded" or "failed"))
                elseif method == "connect_preset" then
                    print("Preset connection " .. (result.success == "1" and "succeeded" or "failed"))
                end
                
                if callback then callback(true, result) end
            else
                print("Error: Failed to parse response")
                if callback then callback(false, parseErr) end
            end
        else
            print("Error: Request failed - " .. tostring(err))
            if callback then callback(false, err) end
        end
    end
    
    HttpClient.Download {
        Url = url,
        Timeout = 30,
        EventHandler = handleResponse
    }
end

-- Login function
function login(callback)
    local params = {
        username = config.username,
        password = config.password
    }
    
    print("Logging in...")
    
    local function handleResponse(tbl, code, data, err, headers)
        if code == 200 and data then
            local result, parseErr = parseXMLResponse(data)
            if result then
                if result.success == "1" and result.token then
                    token = result.token
                    token_timestamp = os.time()
                    print("Login successful")
                    if callback then callback(true) end
                else
                    print("Error: Invalid login response")
                    if callback then callback(false, "Invalid login response") end
                end
            else
                print("Error: Failed to parse login response")
                if callback then callback(false, parseErr) end
            end
        else
            print("Error: Login failed - " .. tostring(err))
            if callback then callback(false, err) end
        end
    end
    
    local url = config.base_url .. "?v=" .. config.api_version .. "&method=login"
    for key, value in pairs(params) do
        url = url .. "&" .. key .. "=" .. value
    end
    
    HttpClient.Download {
        Url = url,
        Timeout = 30,
        EventHandler = handleResponse
    }
end

-- Logout function
function logout(callback)
    if not token then
        if callback then callback(true) end
        return
    end
    
    makeRequest("logout", {}, function(success, data, err)
        if success and data then
            local result, parseErr = parseXMLResponse(data)
            if result and result.success == "1" then
                token = nil
                print("Logout successful")
                if callback then callback(true) end
            else
                local errorMsg = formatError(parseErr)
                print("Logout failed: " .. errorMsg)
                if callback then callback(false, errorMsg) end
            end
        else
            local errorMsg = formatError(err)
            print("Logout failed: " .. errorMsg)
            if callback then callback(false, errorMsg) end
        end
    end)
end

-- Get devices with periodic checking
function getDevices(callback)
    if not token then
        login(function(success, err)
            if not success then
                print("Login failed: " .. formatError(err))
                if callback then callback(nil, "Login failed: " .. formatError(err)) end
            else
                makeRequest("get_devices", {}, function(success, data, err)
                    if success and data then
                        local result, parseErr = parseXMLResponse(data)
                        if result then
                            if callback then callback(result) end
                        else
                            local errorMsg = formatError(parseErr)
                            if callback then callback(nil, errorMsg) end
                        end
                    else
                        local errorMsg = formatError(err)
                        if callback then callback(nil, errorMsg) end
                    end
                end)
            end
        end)
    else
        makeRequest("get_devices", {}, function(success, data, err)
            if success and data then
                local result, parseErr = parseXMLResponse(data)
                if result then
                    if callback then callback(result) end
                else
                    local errorMsg = formatError(parseErr)
                    if callback then callback(nil, errorMsg) end
                end
            else
                local errorMsg = formatError(err)
                if callback then callback(nil, errorMsg) end
            end
        end)
    end
end

-- Connect to a channel
function connectChannel(channelId, mode, callback)
    if not token then
        login(function(success, err)
            if not success then
                print("Login failed: " .. formatError(err))
                if callback then callback(nil, "Login failed: " .. formatError(err)) end
            else
                print("Connecting to channel: " .. channelId)
                local params = {id = channelId}
                if mode then params.mode = mode end
                makeRequest("connect_channel", params, function(success, data, err)
                    if success and data then
                        local result, parseErr = parseXMLResponse(data)
                        if result then
                            if callback then callback(result) end
                        else
                            local errorMsg = formatError(parseErr)
                            if callback then callback(nil, errorMsg) end
                        end
                    else
                        local errorMsg = formatError(err)
                        if callback then callback(nil, errorMsg) end
                    end
                end)
            end
        end)
    else
        print("Connecting to channel: " .. channelId)
        local params = {id = channelId}
        if mode then params.mode = mode end
        makeRequest("connect_channel", params, function(success, data, err)
            if success and data then
                local result, parseErr = parseXMLResponse(data)
                if result then
                    if callback then callback(result) end
                else
                    local errorMsg = formatError(parseErr)
                    if callback then callback(nil, errorMsg) end
                end
            else
                local errorMsg = formatError(err)
                if callback then callback(nil, errorMsg) end
            end
        end)
    end
end

-- Disconnect from a channel
function disconnectChannel(channelId, force, callback)
    if not token then
        login(function(success, err)
            if not success then
                print("Login failed: " .. formatError(err))
                if callback then callback(nil, "Login failed: " .. formatError(err)) end
            else
                print("Disconnecting from channel: " .. channelId)
                local params = {id = channelId}
                if force then params.force = 1 end
                makeRequest("disconnect_channel", params, function(success, data, err)
                    if success and data then
                        local result, parseErr = parseXMLResponse(data)
                        if result then
                            if callback then callback(result) end
                        else
                            local errorMsg = formatError(parseErr)
                            if callback then callback(nil, errorMsg) end
                        end
                    else
                        local errorMsg = formatError(err)
                        if callback then callback(nil, errorMsg) end
                    end
                end)
            end
        end)
    else
        print("Disconnecting from channel: " .. channelId)
        local params = {id = channelId}
        if force then params.force = 1 end
        makeRequest("disconnect_channel", params, function(success, data, err)
            if success and data then
                local result, parseErr = parseXMLResponse(data)
                if result then
                    if callback then callback(result) end
                else
                    local errorMsg = formatError(parseErr)
                    if callback then callback(nil, errorMsg) end
                end
            else
                local errorMsg = formatError(err)
                if callback then callback(nil, errorMsg) end
            end
        end)
    end
end

-- Get presets
function getPresets(callback)
    if not token then
        login(function(success, err)
            if not success then
                print("Login failed: " .. formatError(err))
                if callback then callback(nil, "Login failed: " .. formatError(err)) end
            else
                makeRequest("get_presets", {}, function(success, data, err)
                    if success and data then
                        local result, parseErr = parseXMLResponse(data)
                        if result then
                            if callback then callback(result) end
                        else
                            local errorMsg = formatError(parseErr)
                            if callback then callback(nil, errorMsg) end
                        end
                    else
                        local errorMsg = formatError(err)
                        if callback then callback(nil, errorMsg) end
                    end
                end)
            end
        end)
    else
        makeRequest("get_presets", {}, function(success, data, err)
            if success and data then
                local result, parseErr = parseXMLResponse(data)
                if result then
                    if callback then callback(result) end
                else
                    local errorMsg = formatError(parseErr)
                    if callback then callback(nil, errorMsg) end
                end
            else
                local errorMsg = formatError(err)
                if callback then callback(nil, errorMsg) end
            end
        end)
    end
end

-- Connect to a preset
function connectPreset(presetId, mode, force, callback)
    if not token then
        login(function(success, err)
            if not success then
                print("Login failed: " .. formatError(err))
                if callback then callback(nil, "Login failed: " .. formatError(err)) end
            else
                print("Connecting to preset: " .. presetId)
                local params = {
                    id = presetId,
                    force = force and "1" or "0"   -- Convert boolean to "1"/"0"
                }
                
                makeRequest("connect_preset", params, function(success, data, err)
                    if success and data then
                        local result, parseErr = parseXMLResponse(data)
                        if result then
                            if result.success == "1" then
                                print("Successfully connected to preset " .. presetId)
                                if callback then callback(result) end
                            else
                                local errorMsg = "Failed to connect to preset: " .. (result.error or "Unknown error")
                                print(errorMsg)
                                if callback then callback(nil, errorMsg) end
                            end
                        else
                            local errorMsg = formatError(parseErr)
                            if callback then callback(nil, errorMsg) end
                        end
                    else
                        local errorMsg = formatError(err)
                        if callback then callback(nil, errorMsg) end
                    end
                end)
            end
        end)
    else
        print("Connecting to preset: " .. presetId)
        local params = {
            id = presetId,
            force = force and "1" or "0"   -- Convert boolean to "1"/"0"
        }
        
        makeRequest("connect_preset", params, function(success, data, err)
            if success and data then
                local result, parseErr = parseXMLResponse(data)
                if result then
                    if result.success == "1" then
                        print("Successfully connected to preset " .. presetId)
                        if callback then callback(result) end
                    else
                        local errorMsg = "Failed to connect to preset: " .. (result.error or "Unknown error")
                        print(errorMsg)
                        if callback then callback(nil, errorMsg) end
                    end
                else
                    local errorMsg = formatError(parseErr)
                    if callback then callback(nil, errorMsg) end
                end
            else
                local errorMsg = formatError(err)
                if callback then callback(nil, errorMsg) end
            end
        end)
    end
end

-- Start periodic checking
function startPeriodicCheck(callback)
    checkTimer:Start(function()
        getDevices(callback)
    end, config.check_interval * 1000)
end

-- Stop periodic checking
function stopPeriodicCheck()
    checkTimer:Stop()
end

-- function main()
--     -- Get list of devices
--     getDevices(function(devices, err)
--         if devices then
--             print("Devices response:")
--             logTable(devices)
--             -- Start periodic checking
--             startPeriodicCheck(function(devices, err)
--                 if devices then
--                     print("Updated devices response:")
--                     logTable(devices)
--                 else
--                     print("Error getting devices: " .. formatError(err))
--                 end
--             end)
--         else
--             print("Error getting devices: " .. formatError(err))
--         end
--     end)
-- end

-- main()

-- Event Handlers
Controls["getDevices"].EventHandler = function()
    print("Getting devices...")
    getDevices(function(devices, err)
        if devices then
            print("Devices retrieved successfully")
            -- You can add additional handling here if needed
        else
            print("Error getting devices: " .. formatError(err))
        end
    end)
end

Controls["getPresets"].EventHandler = function()
    print("Getting presets...")
    getPresets(function(presets, err)
        if presets then
            print("Presets retrieved successfully")
            -- You can add additional handling here if needed
        else
            print("Error getting presets: " .. formatError(err))
        end
    end)
end

for i = 1, #Controls["connectPreset"], 1 do
    Controls["connectPreset"][i].EventHandler = function()
        print("Connecting to PRESET " .. i .. "...")
        -- Convert preset number to ID (assuming PRESET 1 = 1, PRESET 2 = 2, etc.)
        local presetId = tostring(i)
        connectPreset(presetId, "video", true, function(result, err)
            if result then
                print("Successfully connected to PRESET " .. i)
            else
                print("Error connecting to PRESET " .. i .. ": " .. formatError(err))
            end
        end)
    end
end
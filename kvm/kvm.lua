-- KVM API Functions for Adder AIM
-- Version: 1.0
-- Using Q-SYS specific extensions

-- Import required modules
local LuaXML = require("LuaXML")
local json = require("json")
myDesk = 1

-- Configuration
local config = {
    base_url = "http://192.168.10.200/api/",
    username = "admin",
    password = "admin",
    api_version = 15,
    check_interval = 5,
    token_timeout = 300
}

-- Global variables
local token = nil
local token_timestamp = nil

-- Helper function to check if token is valid
local function isTokenValid()
    if not token or not token_timestamp then
        return false
    end
    return (os.time() - token_timestamp) < config.token_timeout
end

function selectButton(controlName, ctrl)
    for i = 1, #Controls[controlName] do
        Controls[controlName][i].Boolean = ctrl == i
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
        return nil, "Invalid XML response type"
    end
    
    if not doc then
        return nil, "Failed to parse XML response"
    end
    
    local response = {}
    
    -- Helper function to get value from LuaXML node
    local function getNodeValue(node)
        if type(node) == "table" and node[1] then
            return node[1]
        end
        return ""
    end
    
    -- Helper function to process a node
    local function processNode(node, result)
        if type(node) ~= "table" then return end
        
        for i, child in ipairs(node) do
            if type(child) == "table" then
                local tag = child[0]
                if tag then
                    if tag == "connection_presets" then
                        result.connection_preset = {}
                        for _, presetNode in ipairs(child) do
                            if type(presetNode) == "table" and presetNode[0] == "connection_preset" then
                                local presetData = {}
                                for _, field in ipairs(presetNode) do
                                    if type(field) == "table" and field[0] then
                                        presetData[field[0]] = getNodeValue(field)
                                    end
                                end
                                table.insert(result.connection_preset, presetData)
                            end
                        end
                    else
                        result[tag] = getNodeValue(child)
                    end
                end
            end
        end
    end
    
    processNode(doc, response)
    return response
end

-- Helper function to make HTTP requests
local function makeRequest(method, params, callback)
    local url = config.base_url .. "?v=" .. config.api_version .. "&method=" .. method
    
    if token then
        url = url .. "&token=" .. token
    end
    
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
                        for _, device in ipairs(result.devices) do
                            logDeviceInfo(device)
                        end
                    end
                elseif method == "get_presets" then
                    print("Presets found: " .. tostring(result.count_presets or 0))
                elseif method == "connect_channel" or method == "disconnect_channel" then
                    print("Operation " .. (result.success == "1" and "succeeded" or "failed"))
                    if result.success ~= "1" and result.errors then
                        print("Error details:")
                        print(json.encode(result.errors))
                    end
                elseif method == "connect_preset" then
                    print("Preset connection " .. (result.success == "1" and "succeeded" or "failed"))
                end
                
                if callback then callback(true, result) end
            else
                print("Error: Failed to parse response")
                print("Parse error: " .. tostring(parseErr))
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
    if isTokenValid() then
        if callback then callback(true) end
        return
    end
    
    local params = {
        username = config.username,
        password = config.password
    }
    
    print("Logging in...")
    makeRequest("login", params, function(success, result)
        if success and result and result.success == "1" and result.token then
            token = result.token
            token_timestamp = os.time()
            print("Login successful")
            if callback then callback(true) end
        else
            print("Login failed")
            if callback then callback(false, "Login failed") end
        end
    end)
end

-- Logout function
function logout(callback)
    if not token then
        if callback then callback(true) end
        return
    end
    
    makeRequest("logout", {}, function(success, result)
        if success and result and result.success == "1" then
            token = nil
            token_timestamp = nil
            print("Logout successful")
            if callback then callback(true) end
        else
            print("Logout failed")
            if callback then callback(false, "Logout failed") end
        end
    end)
end

-- Connect to preset function
function connectPreset(presetId, mode, callback)
    if not isTokenValid() then
        login(function(success, err)
            if not success then
                print("Login failed: " .. formatError(err))
                if callback then callback(false, "Login failed: " .. formatError(err)) end
            else
                connectPreset(presetId, mode, callback)
            end
        end)
        return
    end
    
    print("Connecting to preset: " .. presetId)
    local params = {
        id = presetId,
        mode = mode or "s"
    }
    
    makeRequest("connect_preset", params, function(success, result)
        if success and result then
            if result.success == "1" then
                print("Successfully connected to preset " .. presetId)
                if callback then callback(true) end
            else
                local errorMsg = "Failed to connect to preset"
                if result.errors and result.errors.error then
                    local error = result.errors.error
                    if error.msg then
                        errorMsg = error.msg
                    end
                    if error.code then
                        errorMsg = errorMsg .. " (Code: " .. error.code .. ")"
                    end
                end
                print(errorMsg)
                if callback then callback(false, errorMsg) end
            end
        else
            local errorMsg = formatError(err)
            if callback then callback(false, errorMsg) end
        end
    end)
end

-- Get channels function
function getChannels(callback)
    if not isTokenValid() then
        login(function(success, err)
            if not success then
                print("Login failed: " .. formatError(err))
                if callback then callback(nil, "Login failed: " .. formatError(err)) end
            else
                getChannels(callback)
            end
        end)
        return
    end
    
    print("Getting channels...")
    makeRequest("get_channels", {}, function(success, result)
        if success and result then
            if result.success == "1" then
                print("Successfully retrieved channels")
                if callback then callback(result.channels) end
            else
                local errorMsg = "Failed to get channels"
                if result.errors and result.errors.error then
                    local error = result.errors.error
                    if error.msg then
                        errorMsg = error.msg
                    end
                    if error.code then
                        errorMsg = errorMsg .. " (Code: " .. error.code .. ")"
                    end
                end
                print(errorMsg)
                if callback then callback(nil, errorMsg) end
            end
        else
            local errorMsg = formatError(err)
            if callback then callback(nil, errorMsg) end
        end
    end)
end

-- Connect to channel function
function connectChannel(channelId, receiverId, mode, callback)
    if not isTokenValid() then
        login(function(success, err)
            if not success then
                print("Login failed: " .. formatError(err))
                if callback then callback(false, "Login failed: " .. formatError(err)) end
            else
                connectChannel(channelId, receiverId, mode, callback)
            end
        end)
        return
    end
    
    print("Connecting to channel: " .. channelId .. " on receiver: " .. receiverId)
    local params = {
        c_id = channelId,
        rx_id = receiverId,
        mode = mode or "s"  -- Default to shared mode if not specified
    }
    
    makeRequest("connect_channel", params, function(success, result)
        if success and result then
            print("Raw response for channel connection:")
            print(json.encode(result))
            
            if result.success == "1" then
                print("Successfully connected to channel " .. channelId)
                if callback then callback(true) end
            else
                local errorMsg = "Failed to connect to channel"
                if result.errors then
                    if type(result.errors) == "table" then
                        if result.errors.error then
                            local error = result.errors.error
                            if type(error) == "table" then
                                if error.msg then
                                    errorMsg = error.msg
                                end
                                if error.code then
                                    errorMsg = errorMsg .. " (Code: " .. error.code .. ")"
                                end
                            end
                        end
                    end
                end
                print("Error details: " .. errorMsg)
                if callback then callback(false, errorMsg) end
            end
        else
            local errorMsg = formatError(err)
            print("Request failed: " .. errorMsg)
            if callback then callback(false, errorMsg) end
        end
    end)
end

-- Disconnect channel function
function disconnectChannel(receiverId, force, callback)
    if not isTokenValid() then
        login(function(success, err)
            if not success then
                print("Login failed: " .. formatError(err))
                if callback then callback(false, "Login failed: " .. formatError(err)) end
            else
                disconnectChannel(receiverId, force, callback)
            end
        end)
        return
    end
    
    print("Disconnecting channel on receiver: " .. (receiverId or "all"))
    local params = {}
    if receiverId then
        params.rx_id = receiverId
    end
    if force then
        params.force = "1"
    end
    
    makeRequest("disconnect_channel", params, function(success, result)
        if success and result then
            if result.success == "1" then
                print("Successfully disconnected channel")
                if callback then callback(true) end
            else
                local errorMsg = "Failed to disconnect channel"
                if result.errors and result.errors.error then
                    local error = result.errors.error
                    if error.msg then
                        errorMsg = error.msg
                    end
                    if error.code then
                        errorMsg = errorMsg .. " (Code: " .. error.code .. ")"
                    end
                end
                print(errorMsg)
                if callback then callback(false, errorMsg) end
            end
        else
            local errorMsg = formatError(err)
            if callback then callback(false, errorMsg) end
        end
    end)
end

function clean()
  for i = 1, #Controls["selectSource"], 1 do
    Controls["selectSource"][i].Boolean = false
    Controls["selectDest"][i].Boolean = false
  end
end

-- Event Handlers
Controls["getDevices"].EventHandler = function()
    print("Getting devices...")
    makeRequest("get_devices", {}, function(success, result)
        if success then
            print("Devices retrieved successfully")
        else
            print("Error getting devices: " .. formatError(result))
        end
    end)
end

Controls["getPresets"].EventHandler = function()
    print("Getting presets...")
    makeRequest("get_presets", {}, function(success, result)
        if success then
            print("Presets retrieved successfully")
        else
            print("Error getting presets: " .. formatError(result))
        end
    end)
end

actualPoste = 1

for i = 1, #Controls["connectPreset"], 1 do
    Controls["connectPreset"][i].EventHandler = function()
        if Controls["connectPreset"][i].Boolean then
            local presetDesired = Controls["presetsNumbers"][i].String
            print("Connecting to PRESET " .. presetDesired .. "...")
            Controls["actualPoste"].String = "POSTE " .. i
            actualPoste = i
            print(actualPoste)
            connectPreset(presetDesired, "s", function(success, err)
            selectButton("connectPreset", i)
                if success then
                    print("Successfully connected to PRESET " .. presetDesired)
                else
                    print("Error connecting to PRESET " .. presetDesired .. ": " .. formatError(err))
                end
            end)
        end
    end
end

-- Event Handlers for channels
Controls["getChannels"].EventHandler = function()
    print("Getting channels...")
    getChannels(function(channels, err)
        if channels then
            print("Channels retrieved successfully")
            -- You can add additional handling here if needed
        else
            print("Error getting channels: " .. formatError(err))
        end
    end)
end

-- Selecting Channels
for i = 1, #Controls["selectSource"], 1 do
    Controls["selectSource"][i].EventHandler = function()
        if Controls["selectSource"][i].Boolean then
            channelId = Controls["channelNumbers"][i].String
            print("Selecting CHANNEL " .. channelId)
        end
    end
end

-- Selecting Receiver
for i = 1, #Controls["selectDest"], 1 do
    Controls["selectDest"][i].EventHandler = function()
        if Controls["selectDest"][i].Boolean then
            receiverId = Controls["receiverNumbers"][i].String
            print("Selecting receiver " .. receiverId)
        end
    end
end

-- Connect to channel event handlers
Controls["connectChannel"].EventHandler = function()
    if Controls["connectChannel"].Boolean then
        local mode = "s"
        print("Connecting to CHANNEL " .. channelId .. " on receiver " .. receiverId .. "...")
        connectChannel(channelId, receiverId, mode, function(success, err)
            if success then
                print("Successfully connected CHANNEL " .. channelId .. " to Receiver " .. receiverId)
            else
                print("Error connecting to CHANNEL " .. channelId .. ": " .. formatError(err))
            end
        end)
        clean()
    end
end

function postPoste(poste, desk)
  local mode = "s"
  local channelId = Controls["channelNumbers"][poste].String
  local receiverId = Controls["receiverNumbers"][desk].String
  print("Connecting to CHANNEL " .. channelId .. " on receiver " .. receiverId .. "...")
  connectChannel(channelId, receiverId, mode, function(success, err)
      if success then
          print("Successfully connected CHANNEL " .. channelId .. " to Receiver " .. receiverId)
      else
          print("Error connecting to CHANNEL " .. channelId .. ": " .. formatError(err))
      end
  end)
  clean()
end

function leftScreenToWall()
  local mode = "s"
  local channelId = Controls["channelNumbers"][actualPoste].String
  local receiverId = Controls["receiverNumbers"][9].String
  print("Connecting to CHANNEL " .. channelId .. " on receiver " .. receiverId .. "...")
  connectChannel(channelId, receiverId, mode, function(success, err)
      if success then
          print("Successfully connected CHANNEL " .. channelId .. " to Receiver " .. receiverId)
      else
          print("Error connecting to CHANNEL " .. channelId .. ": " .. formatError(err))
      end
  end)
  clean()
end

function rightScreenToWall()
  local mode = "s"
  local channelId = Controls["channelNumbers"][actualPoste + 4].String
  local receiverId = Controls["receiverNumbers"][9].String
  print("Connecting to CHANNEL " .. channelId .. " on receiver " .. receiverId .. "...")
  connectChannel(channelId, receiverId, mode, function(success, err)
      if success then
          print("Successfully connected CHANNEL " .. channelId .. " to Receiver " .. receiverId)
      else
          print("Error connecting to CHANNEL " .. channelId .. ": " .. formatError(err))
      end
  end)
  clean()
end

function initWall()
  local mode = "s"
  local channelId = Controls["channelNumbers"][9].String
  local receiverId = Controls["receiverNumbers"][9].String
  print("Connecting to CHANNEL " .. channelId .. " on receiver " .. receiverId .. "...")
  connectChannel(channelId, receiverId, mode, function(success, err)
      if success then
          print("Successfully connected CHANNEL " .. channelId .. " to Receiver " .. receiverId)
      else
          print("Error connecting to CHANNEL " .. channelId .. ": " .. formatError(err))
      end
  end)
  clean()
end

Controls["screenToWall"][1].EventHandler = function()
  if Controls["screenToWall"][1].Boolean then
    selectButton("screenToWall", 1) 
    leftScreenToWall()
  else 
    initWall()
  end
end 

Controls["screenToWall"][2].EventHandler = function()
  if Controls["screenToWall"][2].Boolean then
    selectButton("screenToWall", 2)  
    rightScreenToWall()
  else 
    initWall()
  end
end 

for i = 1, #Controls["postPoste"], 1 do
  Controls["postPoste"][i].EventHandler = function()
    if Controls["postPoste"][i].Boolean then
      print("POSTE DESIRED > " .. i)
      local channelId = Controls["channelNumbers"][i].String
      local receiverId = Controls["receiverNumbers"][myDesk].String
      selectButton("postPoste", i)  
      postPoste(channelId, myDesk)
      Timer.CallAfter(
        function()
          postPoste(poste + 4, myDesk + 4)
        end,
        0.5
      )
    end
  end 
end


Controls["liveModeOn"].EventHandler = function()
    if Controls["liveModeOn"].Boolean then 
      liveModeOn()
    end
  end 
  
  Controls["liveModeOff"].EventHandler = function()
    if Controls["liveModeOff"].Boolean then 
      liveModeOff()
    end
  end 
  
  Controls["ledState"].EventHandler = function()
    if Controls["ledState"].Boolean then 
      liveModeOn()
    else 
      liveModeOff()
    end
  end 
  
  
  function liveModeOn()
    Controls["ledState"].Boolean = true
    Controls["ledState"].Legend = "ON AIR"
    print("ON AIR")
  end
  
  function liveModeOff()
    Controls["ledState"].Boolean = false
    Controls["ledState"].Legend = "FREE"
    print("NOT ON AIR")
  end
  
  
  ---------------------------------OSC------------------------------------
  
  -- OSC Receiver for Q-Sys
  -- This script implements UDP unicast reception functionality
  
  -- Configuration
  local PORT = 8000  -- Port to listen for UDP messages
  local INTERFACE_IP = "192.168.1.100"  -- IP address of the interface to listen on
  
  -- Create UDP socket
  local udp = UdpSocket.New()
  
  -- Function to parse OSC message
  function ParseOSCMessage(data)
      -- OSC message format: address + typetag + arguments
      local address = ""
      local typetag = ""
      local args = {}
      
      -- Find address (ends with null byte)
      local nullPos = string.find(data, "\0")
      if nullPos then
          address = string.sub(data, 1, nullPos - 1)
          data = string.sub(data, nullPos + 1)
      end
      
      -- Find typetag (starts with ',' and ends with null byte)
      nullPos = string.find(data, "\0")
      if nullPos then
          typetag = string.sub(data, 2, nullPos - 1)  -- Skip the ',' character
          data = string.sub(data, nullPos + 1)
      end
      
      -- Parse arguments based on typetag
      for i = 1, #typetag do
          local tag = string.sub(typetag, i, i)
          if tag == "i" then  -- Integer
              local value = string.unpack(">i4", data)
              table.insert(args, value)
              data = string.sub(data, 5)
          elseif tag == "f" then  -- Float
              local value = string.unpack(">f", data)
              table.insert(args, value)
              data = string.sub(data, 5)
          elseif tag == "s" then  -- String
              local nullPos = string.find(data, "\0")
              if nullPos then
                  local value = string.sub(data, 1, nullPos - 1)
                  table.insert(args, value)
                  data = string.sub(data, nullPos + 1)
              end
          end
      end
      
      return address, args
  end
  
  -- Function to handle incoming UDP packets
  udp.EventHandler = function(udp, packet)
      print("Received UDP packet:")
      print("From: " .. packet.Address .. ":" .. packet.Port)
      
      -- Parse OSC message
      local address, args = ParseOSCMessage(packet.Data)
      print("OSC Address: " .. address)
      print("OSC Arguments: " .. table.concat(args, ", "))
      
      -- Example of handling specific OSC addresses
      if address == "/qsys/liveMode/on" then
          print("LIVE MODE IS ON")
          Controls["liveModeOn"].Boolean = true 
          liveModeOn()
      elseif address == "/qsys/liveMode/off" then
          print("LIVE MODE IS OFF")
          Controls["liveModeOff"].Boolean = true 
          liveModeOff()
      end
  end
  
  -- Open UDP socket on specific interface
  print("Opening UDP socket on interface " .. INTERFACE_IP .. " port " .. PORT)
  udp:Open(INTERFACE_IP, PORT)  -- Listen on specific interface
  
  -- Cleanup function
  function OnShutdown()
      if udp then
          udp:Close()
      end
  end 
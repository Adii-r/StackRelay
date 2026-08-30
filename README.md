# StackRelay

A dark themed, two page visualization site that explains DevOps concepts the way a network diagram explains a network: as things moving along traces, hop by hop.

- **Pipeline Flow** — a CI/CD pipeline rendered as a circuit board topology. A glowing packet travels from `COMMIT` to `PROD` across eight nodes, with a live terminal log and a failure mode that reroutes the packet to a `ROLLBACK` node instead of shipping to production.
- **Load Balancing**  — three clients, one balancer, four servers. Request packets stream continuously and get routed by Round Robin, Least Connections, or Weighted strategy. Server load bars fill and decay in real time, and clicking a server takes it offline so you can watch traffic reroute around it.

## How the pipeline animation works 

1. Eight nodes (`COMMIT → BUILD → TEST → SCAN → STAGE → VERIFY → APPROVE → PROD`) are connected by seven individual SVG path segments.
2. Clicking **Run Deployment** animates a packet element along each segment in sequence, easing the progress with a custom cubic curve.
3. Each node lights up (`active` → `pass`) as the packet arrives, and a line is appended to the terminal log with a timestamp.
4. If **Simulate security failure** is checked, the packet diverts off the `SCAN` node down a dashed red trace to a `ROLLBACK` node instead of continuing toward `PROD`.
5. **Reset** clears all node/segment states and the log.

## How the load balancer works 

1. Three client nodes send request packets to a central `BALANCER` node; the balancer forwards each one to one of four servers.
2. **Start Traffic** spawns a new request roughly twice a second. Each request animates from a random client → balancer → chosen server.
3. The routing strategy (Round Robin, Least Connections, Weighted Random) is selected from the segmented control and determines which online server is chosen next.
4. Each server has a `load` value that increases when it receives a request and decays automatically over time; the load bar and node color reflect current load (idle / high / overloaded).
5. Clicking a server toggles it offline — it's excluded from routing until clicked again, demonstrating failover.
6. **Reset** stops the stream, zeroes out all server loads, and brings every server back online.

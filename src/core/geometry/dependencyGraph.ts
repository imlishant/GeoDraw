export class DependencyGraph {
    private dependencies: Map<string, Set<string>> = new Map();
    private dependents: Map<string, Set<string>> = new Map();

    clear() {
        this.dependencies.clear();
        this.dependents.clear();
    }

    addNode(id: string, dependencies: string[]) {
        // Register dependencies for this node
        this.dependencies.set(id, new Set(dependencies));

        // Register this node as a dependent for each dependency
        dependencies.forEach(depId => {
            if (!this.dependents.has(depId)) {
                this.dependents.set(depId, new Set());
            }
            this.dependents.get(depId)!.add(id);
        });
    }

    removeNode(id: string) {
        // Remove this node from others' dependents lists
        const deps = this.dependencies.get(id);
        if (deps) {
            deps.forEach(depId => {
                const dependentSet = this.dependents.get(depId);
                if (dependentSet) {
                    dependentSet.delete(id);
                }
            });
        }
        this.dependencies.delete(id);

        // Remove this node's dependents (cascade delete or just untrack?)
        // For now, we just remove the entry. The caller handles cascading deletion of elements.
        this.dependents.delete(id);
    }

    getDependents(id: string): string[] {
        return Array.from(this.dependents.get(id) || []);
    }

    getDependencies(id: string): string[] {
        return Array.from(this.dependencies.get(id) || []);
    }

    /**
     * Get a topologically sorted list of all elements that need to update
     * when the startNodes change.
     */
    getUpdateOrder(startNodes: string[]): string[] {
        const result: string[] = [];

        // Simple BFS for now since we don't have cycles in geometry construction (usually)
        // For a true topological sort in a DAG, we'd need more complex logic,
        // but for "A moves -> update B -> update C", BFS/level-order is often sufficient 
        // if we just want to find *what* to update. 
        // However, to ensure B is updated before C (if C depends on B), we need topological sort.

        // Let's do a subgraph extraction and then topological sort.

        // 1. Find all reachable nodes (transitive closure)
        const reachable = new Set<string>();
        const exploreQueue = [...startNodes];
        while (exploreQueue.length > 0) {
            const current = exploreQueue.shift()!;
            if (reachable.has(current)) continue;
            // Don't add start nodes to reachable if we only want *dependents*, 
            // but usually we want the full update list. 
            // Let's assume startNodes are already updated, so we want dependents.
            if (!startNodes.includes(current)) {
                reachable.add(current);
            }

            const deps = this.dependents.get(current);
            if (deps) {
                deps.forEach(d => exploreQueue.push(d));
            }
        }

        if (reachable.size === 0) return [];

        // 2. Topological sort on the reachable subgraph
        // Calculate in-degrees within the subgraph
        const inDegree = new Map<string, number>();
        reachable.forEach(node => inDegree.set(node, 0));

        reachable.forEach(node => {
            const deps = this.dependencies.get(node);
            if (deps) {
                deps.forEach(dep => {
                    // Only count dependencies that are either in the reachable set OR are the start nodes
                    // Actually, we only care about dependencies *within* the set of things to update.
                    // If a node depends on a startNode, that dependency is "satisfied" (it's the trigger).
                    // If it depends on another reachable node, we must wait for that node.
                    if (reachable.has(dep)) {
                        inDegree.set(node, (inDegree.get(node) || 0) + 1);
                    }
                });
            }
        });

        // 3. Kahn's Algorithm
        const zeroDegreeQueue: string[] = [];
        reachable.forEach(node => {
            if ((inDegree.get(node) || 0) === 0) {
                zeroDegreeQueue.push(node);
            }
        });

        while (zeroDegreeQueue.length > 0) {
            const current = zeroDegreeQueue.shift()!;
            result.push(current);

            const dependents = this.dependents.get(current);
            if (dependents) {
                dependents.forEach(dep => {
                    if (reachable.has(dep)) {
                        const newDegree = (inDegree.get(dep) || 0) - 1;
                        inDegree.set(dep, newDegree);
                        if (newDegree === 0) {
                            zeroDegreeQueue.push(dep);
                        }
                    }
                });
            }
        }

        return result;
    }
}
